// Check the same roots/options as tsconfig.contracts.json in deterministic batches.
// TypeScript retains every distinct literal state instantiation until program exit;
// large independent native-oracle fixtures otherwise exhaust its default heap.
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = join(root, 'tsconfig.contracts.json');
const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(loaded.config, ts.sys, root, undefined, configPath);
if (config.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(config.errors, { getCanonicalFileName: path => path, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
const fixtures = config.fileNames.filter(path => relative(root, path).startsWith(`test${sep}types${sep}`)).sort();
const fixtureSet = new Set(fixtures);
const sources = config.fileNames.filter(path => !fixtureSet.has(path)).sort();
if (!fixtures.length || !sources.length) throw new Error('Expected source roots and contract fixtures');
// Keep the config beneath the project so automatic @types discovery is identical.
const directory = await mkdtemp(join(root, '.type-git-check-'));
const batchSize = 12;
// Heavy literal fixtures can request a fresh compiler process without changing
// their assertions, source roots, compiler options or the default heap limit.
const batches = [];
let pending = [];
for (const fixture of fixtures) {
  const isolated = (await readFile(fixture, 'utf8')).startsWith('// @typecheck-isolated:');
  if (isolated) {
    if (pending.length) batches.push(pending);
    pending = [];
    batches.push([fixture]);
  } else {
    pending.push(fixture);
    if (pending.length === batchSize) {
      batches.push(pending);
      pending = [];
    }
  }
}
if (pending.length) batches.push(pending);
try {
  for (const [index, batch] of batches.entries()) {
    const target = join(directory, 'tsconfig.json');
    await writeFile(target, JSON.stringify({ extends: configPath, files: [...sources, ...batch], include: [], exclude: [] }));
    console.log(`Type contracts ${index + 1}/${batches.length}: ${batch.map(path => relative(root, path)).join(', ')}`);
    const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', target], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Contract batch failed (${result.signal ?? result.status})`);
  }
  console.log(`Checked all ${fixtures.length} contract fixtures with all ${sources.length} source roots in each batch.`);
} finally { await rm(directory, { recursive: true, force: true }); }
