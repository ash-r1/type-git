// Snapshot the refusal sites and same-file references of every function that a completion
// closure in spec/command-audit.json lists, extracted from the pinned Git source.
//
//   node scripts/import-refusal-sites.mjs <git-2.55.0>
//
// command-coverage.mjs compares closures with this snapshot in CI, where the Git source is
// not available; verify-upstream.mjs reproduces it byte for byte from the source.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { referencedFunctions, refusalSites } from './refusal-sites.mjs';

const [gitInput] = process.argv.slice(2);
if (!gitInput) throw new Error('Usage: node scripts/import-refusal-sites.mjs <git-2.55.0>');
const git = resolve(gitInput);
const root = new URL('../', import.meta.url);
const audit = JSON.parse(await readFile(new URL('spec/command-audit.json', root), 'utf8'));
const inventory = JSON.parse(await readFile(new URL('spec/upstream/command-inventory.json', root), 'utf8'));
const wanted = new Map();
for (const record of Object.values(audit.commands)) {
  for (const [file, names] of Object.entries(record.closure?.sources ?? {})) {
    const set = wanted.get(file) ?? new Set();
    for (const name of names) set.add(name);
    wanted.set(file, set);
  }
}
const files = {};
for (const file of [...wanted.keys()].sort()) {
  const bytes = await readFile(join(git, file));
  const source = bytes.toString('utf8');
  const functions = {};
  for (const name of [...wanted.get(file)].sort()) {
    functions[name] = {
      sites: refusalSites(source, name).map(({ call, text, line }) => ({ call, text, line })),
      references: referencedFunctions(source, name),
    };
  }
  files[file] = { sha256: createHash('sha256').update(bytes).digest('hex'), functions };
}
const snapshot = { baseline: inventory.baselines.git, extractor: 'scripts/refusal-sites.mjs', files };
await writeFile(new URL('spec/upstream/git-refusal-sites.json', root), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Recorded refusal sites for ${Object.values(files).reduce((n, f) => n + Object.keys(f.functions).length, 0)} functions.`);
