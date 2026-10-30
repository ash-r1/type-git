import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupeDeclarations } from './dedupe-declarations.mjs';

const require = createRequire(import.meta.url);
const declarations = await mkdtemp(join(tmpdir(), 'type-git-declarations-'));
function run(executable, args, env = process.env) {
  const result = spawnSync(process.execPath, [executable, ...args], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build process failed (${result.signal ?? result.status})`);
}
try {
  // Type safety is checked separately by typecheck/prepublishOnly. Emit once,
  // then let the bundler consume declarations without keeping a second source
  // checker and its serialization graph alive in the same worker.
  run(require.resolve('typescript/bin/tsc'), ['--noCheck', '--emitDeclarationOnly', '--declarationMap', 'false', '--outDir', declarations]);
  const cli = join(dirname(require.resolve('tsup/package.json')), require('tsup/package.json').bin.tsup);
  run(cli, process.argv.slice(2), { ...process.env, TYPE_GIT_DECLARATIONS_DIR: declarations });
  // Ship shared declaration chunks once (CJS format) instead of as ESM + CJS twins.
  await dedupeDeclarations(fileURLToPath(new URL('..', import.meta.url)));
} finally {
  await rm(declarations, { recursive: true, force: true });
}
