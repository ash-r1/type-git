// Verify TypeScript's per-run incremental cache across the runner's changing roots.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
test('incremental contract batches check new roots, edited fixtures and changed dependencies', async () => {
  const directory = await mkdtemp(join(root, '.type-git-check-cache-test-'));
  const api = join(directory, 'api.ts');
  const first = join(directory, 'first.ts');
  const next = join(directory, 'next.ts');
  const config = join(directory, 'tsconfig.json');
  const source = value => `export function consume(value: '${value}'): void { void value; }\n`;
  const fixture = value => `import { consume } from './api.js';\nconsume('${value}');\n`;
  const check = async (file, accepted) => {
    await writeFile(config, JSON.stringify({
      extends: join(root, 'tsconfig.contracts.json'),
      compilerOptions: { incremental: true, tsBuildInfoFile: join(directory, 'contracts.tsbuildinfo') },
      files: [api, file], include: [], exclude: [],
    }));
    const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', config], { cwd: root, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    if (accepted) assert.equal(result.status, 0, result.stdout + result.stderr);
    else { assert.equal(result.status, 2); assert.match(result.stdout, /TS2345/); }
  };
  try {
    await writeFile(api, source('ok'));
    await writeFile(first, fixture('ok'));
    await check(first, true); // Populate cache for the shared dependency.
    await writeFile(next, fixture('wrong'));
    await check(next, false); // A newly selected root must be checked.
    await writeFile(next, fixture('ok'));
    await check(next, true); // Stale diagnostics must be invalidated.
    await writeFile(api, source('changed'));
    await check(next, false); // An unchanged fixture must observe its new dependency.
    await writeFile(api, source('ok'));
    await check(next, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
