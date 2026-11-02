#!/usr/bin/env node
// Checks the compile-time contract suite (tsconfig.contracts.json) as a fixed
// set of shards, one TypeScript program per shard, run one after another.
//
// Every root of tsconfig.contracts.json is checked exactly once:
// - shard 1 holds `src/**/*` plus its share of `test/types/*.ts`;
// - the other shards hold only their share of `test/types/*.ts`.
// Each contract file is an ES module that imports no other contract file, and
// none declares globals, so its diagnostics do not depend on which other
// contract files share the program. Splitting therefore keeps every diagnostic
// while letting each compiler process start from an empty heap.
//
// Usage:
//   node scripts/test-types.mjs              # check every shard
//   node scripts/test-types.mjs --shard 2    # check one shard
//   node scripts/test-types.mjs --list       # print the shard plan
//   node scripts/test-types.mjs --diagnostics  # pass --extendedDiagnostics

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Measured with TypeScript 5.9 on the 301 contract files of 2026-11-02: four
// shards peaked at 4.5-5.1 GB each, so six shards under an 8 GiB heap leave
// room for the corpus to grow on a 16 GB CI runner (one process at a time).
const SHARD_COUNT = 6;
const HEAP_MB = 8192;
const contractsConfig = join(root, 'tsconfig.contracts.json');
const contractsDir = join(root, 'test/types');
const cacheDir = join(root, 'node_modules/.cache');
const tscBin = join(root, 'node_modules/typescript/bin/tsc');

let listOnly = false;
let diagnostics = false;
let onlyShard;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--list') listOnly = true;
  else if (arg === '--diagnostics') diagnostics = true;
  else if (arg === '--shard' || arg.startsWith('--shard=')) {
    const value = arg === '--shard' ? args[++i] : arg.slice('--shard='.length);
    if (!/^[1-9][0-9]*$/.test(value ?? '') || Number(value) > SHARD_COUNT) {
      console.error(`--shard expects an integer from 1 to ${SHARD_COUNT}`);
      process.exit(2);
    }
    onlyShard = Number(value);
  } else {
    console.error(`Unknown argument: ${arg}`);
    console.error('Usage: node scripts/test-types.mjs [--list] [--shard <n>] [--diagnostics]');
    process.exit(2);
  }
}

// The shard plan only covers the roots this script knows how to split. Fail
// loudly if tsconfig.contracts.json gains a root or option the plan ignores.
const contracts = JSON.parse(readFileSync(contractsConfig, 'utf8'));
const expectedInclude = ['src/**/*', 'test/types/**/*.ts'];
if (
  JSON.stringify(contracts.include) !== JSON.stringify(expectedInclude) ||
  JSON.stringify(contracts.exclude) !==
    JSON.stringify(['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts']) ||
  contracts.files !== undefined ||
  contracts.references !== undefined
) {
  console.error(
    'tsconfig.contracts.json roots changed; update scripts/test-types.mjs to cover them.',
  );
  process.exit(2);
}

// `test/types/**/*.ts` is flat today; reject nested contract directories so a
// new subdirectory cannot silently fall outside every shard.
const entries = readdirSync(contractsDir, { withFileTypes: true });
const nested = entries.filter((entry) => entry.isDirectory());
if (nested.length > 0) {
  console.error(
    `Nested contract directories are not sharded: ${nested.map((d) => d.name).join(', ')}`,
  );
  process.exit(2);
}
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => join(contractsDir, entry.name))
  .sort();

// Deterministic greedy bin packing by file size: largest file first, into the
// lightest shard (lowest index on ties).
const shards = Array.from({ length: SHARD_COUNT }, (_, index) => ({
  index: index + 1,
  weight: 0,
  files: [],
}));
const bySize = files
  .map((file) => ({ file, size: statSync(file).size }))
  .sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));
for (const { file, size } of bySize) {
  const target = shards.reduce((best, shard) => (shard.weight < best.weight ? shard : best));
  target.files.push(file);
  target.weight += size;
}
for (const shard of shards) shard.files.sort();

const covered = shards.flatMap((shard) => shard.files);
if (covered.length !== files.length || new Set(covered).size !== files.length) {
  console.error('Shard plan does not cover every contract file exactly once.');
  process.exit(2);
}

if (listOnly) {
  for (const shard of shards) {
    const extra = shard.index === 1 ? ' + src/**/*' : '';
    console.log(`shard ${shard.index}: ${shard.files.length} files, ${shard.weight} bytes${extra}`);
    for (const file of shard.files) console.log(`  ${relative(root, file)}`);
  }
  process.exit(0);
}

// A private directory per run, so concurrent runs cannot remove each other's
// shard configs. It is removed when the run ends.
mkdirSync(cacheDir, { recursive: true });
const shardDir = mkdtempSync(join(cacheDir, 'type-git-test-types-'));
process.on('exit', () => rmSync(shardDir, { recursive: true, force: true }));

let failed = 0;
for (const shard of shards) {
  if (onlyShard !== undefined && shard.index !== onlyShard) continue;
  const configPath = join(shardDir, `shard-${shard.index}.json`);
  const config = {
    extends: contractsConfig,
    files: shard.files,
    include: shard.index === 1 ? [join(root, 'src/**/*')] : [],
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const roots = `${shard.files.length} contract files${shard.index === 1 ? ' + src' : ''}`;
  const label = `test:types shard ${shard.index}/${SHARD_COUNT} (${roots})`;
  console.log(`> ${label}`);
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${HEAP_MB}`,
      tscBin,
      '--project',
      configPath,
      ...(diagnostics ? ['--extendedDiagnostics'] : []),
    ],
    { cwd: root, stdio: 'inherit' },
  );
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error) console.error(result.error);
  if (result.status !== 0) {
    failed += 1;
    console.error(
      `x ${label} failed after ${seconds}s (exit ${result.status ?? result.signal})`,
    );
  } else {
    console.log(`ok ${label} in ${seconds}s`);
  }
}

if (failed > 0) {
  console.error(`test:types: ${failed} shard(s) failed`);
  process.exit(1);
}
