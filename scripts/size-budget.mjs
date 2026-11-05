#!/usr/bin/env node
// Checks that the lightweight entry points stay lightweight after `pnpm build`.
//
// - Bundles a consumer that only calls `repo.status()` through `type-git/node` with esbuild
//   (minified, Node platform) and checks the minified and gzip sizes.
// - Measures the declaration files reachable from each lightweight entry's `types` target.
//
// The grammar catalogue lives in `type-git/strict`; if any of it leaks back into the main
// entry points, these numbers grow by an order of magnitude (1.6 MB bundle, 5 MB declarations
// in 0.6.0), so the budgets leave ample room for normal growth while catching that.
//
// Usage: node scripts/size-budget.mjs [--json]

import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// esbuild is a dependency of tsup; resolve it from there rather than adding a direct one.
const esbuild = createRequire(require.resolve('tsup/package.json'))('esbuild');

const BUDGET = {
  bundleBytes: 400 * 1024,
  bundleGzipBytes: 100 * 1024,
  declarationBytes: 1024 * 1024,
};

const LIGHTWEIGHT = ['.', './node', './bun', './deno'];
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

async function declarationBytes(entry) {
  const seen = new Set();
  const queue = [entry];
  let bytes = 0;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = await readFile(file, 'utf8');
    bytes += Buffer.byteLength(text);
    for (const match of text.matchAll(SPECIFIER)) {
      const spec = match[1];
      const target = resolve(dirname(file), spec);
      queue.push(
        target.endsWith('.cjs')
          ? `${target.slice(0, -'.cjs'.length)}.d.cts`
          : `${target.replace(/\.js$/, '')}.d.ts`,
      );
    }
  }
  return bytes;
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const results = { declarations: {} };
for (const subpath of LIGHTWEIGHT) {
  for (const condition of ['import', 'require']) {
    const types = pkg.exports[subpath][condition].types;
    results.declarations[`${subpath} (${condition})`] = await declarationBytes(join(root, types));
  }
}

const work = await mkdtemp(join(tmpdir(), 'type-git-size-'));
try {
  await symlink(root, join(work, 'type-git'), 'junction');
  const consumer = join(work, 'status-only.mjs');
  await writeFile(
    consumer,
    [
      "import { TypeGit } from 'type-git/node';",
      'const git = await TypeGit.create();',
      'const repo = await git.open(process.cwd());',
      'console.log(await repo.status());',
      '',
    ].join('\n'),
  );
  const built = await esbuild.build({
    entryPoints: [consumer],
    bundle: true,
    minify: true,
    platform: 'node',
    format: 'esm',
    write: false,
    nodePaths: [work],
    logLevel: 'silent',
  });
  const code = built.outputFiles[0].contents;
  results.bundleBytes = code.length;
  results.bundleGzipBytes = gzipSync(code, { level: 9 }).length;
} finally {
  await rm(work, { recursive: true, force: true });
}

const failures = [];
if (results.bundleBytes > BUDGET.bundleBytes) failures.push('bundle');
if (results.bundleGzipBytes > BUDGET.bundleGzipBytes) failures.push('bundle (gzip)');
for (const [name, bytes] of Object.entries(results.declarations)) {
  if (bytes > BUDGET.declarationBytes) failures.push(`declarations ${name}`);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ budget: BUDGET, results }, null, 2));
} else {
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(`status-only bundle: ${kb(results.bundleBytes)} (budget ${kb(BUDGET.bundleBytes)})`);
  console.log(
    `status-only bundle, gzip: ${kb(results.bundleGzipBytes)} (budget ${kb(BUDGET.bundleGzipBytes)})`,
  );
  for (const [name, bytes] of Object.entries(results.declarations)) {
    console.log(`declarations ${name}: ${kb(bytes)} (budget ${kb(BUDGET.declarationBytes)})`);
  }
}
if (failures.length > 0) {
  console.error(`Size budget exceeded: ${failures.join(', ')}`);
  process.exit(1);
}
