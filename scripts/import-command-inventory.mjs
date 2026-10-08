import { cobraCompletion } from './cobra-completion.mjs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Read source trees only. Never execute the commands being inventoried: many mutate
// repositories, start servers, access credentials, or implement binary protocols.
const [gitRoot, lfsRoot, cobraRoot] = process.argv.slice(2);
if (!gitRoot || !lfsRoot || !cobraRoot) throw new Error('Usage: node scripts/import-command-inventory.mjs <git-2.55.0> <git-lfs-3.8.0> <cobra-1.10.2>');
const sources = {};
async function source(project, file) {
  const text = await readFile(join(project === 'git' ? gitRoot : lfsRoot, file), 'utf8');
  sources[`${project}/${file}`] = createHash('sha256').update(text).digest('hex');
  return text;
}
if (!(await source('git', 'GIT-VERSION-GEN')).includes('DEF_VER=v2.55.0')) throw new Error('Expected Git 2.55.0 sources');
if (!/Version = \"3\.8\.0\"/.test(await source('lfs', 'config/version.go'))) throw new Error('Expected Git LFS 3.8.0 sources');
const entries = new Map();
function add(command, classification, evidence) {
  const old = entries.get(command);
  if (old) {
    old.sources = [...new Set([...old.sources, evidence])].sort();
  } else entries.set(command, { command, classification, sources: [evidence] });
}
const list = await source('git', 'command-list.txt');
for (const line of list.split('\n')) {
  const [name, ...categories] = line.trim().split(/\s+/);
  if (name.startsWith('git-')) add(name.slice(4), 'documented', 'git/command-list.txt');
  else if (['gitk', 'gitweb', 'scalar'].includes(name)) add(name, 'companion', 'git/command-list.txt');
}
const registry = await source('git', 'git.c');
const functions = new Map();
for (const file of (await readdir(join(gitRoot, 'builtin'))).filter((file) => file.endsWith('.c')).sort()) {
  const text = await source('git', `builtin/${file}`);
  for (const match of text.matchAll(/\bint\s+(cmd_\w+)\s*\(/g)) functions.set(match[1], { file, text });
}
for (const match of registry.matchAll(/\{\s*"([\w-]+)",\s*(cmd_\w+)\b/g)) {
  const [, name, fn] = match;
  add(name, 'builtin-undocumented', 'git/git.c');
  const impl = functions.get(fn);
  if (!impl) continue;
  add(name, 'builtin-undocumented', `git/builtin/${impl.file}`);
  // Shared source files can contain more than one command's dispatch table.
  // These are candidates, retained separately until their scope is reviewed.
  const candidates = [...impl.text.matchAll(/OPT_SUBCOMMAND(?:_F)?\("([\w-]+)"/g)].map((m) => m[1]);
  if (candidates.length) entries.get(name).subcommandCandidates = [...new Set(candidates)].sort();
}
for (const file of (await readdir(join(lfsRoot, 'commands'))).filter((f) => f.endsWith('.go') && !f.endsWith('_test.go')).sort()) {
  const text = await source('lfs', `commands/${file}`);
  for (const match of text.matchAll(/RegisterCommand\("([\w-]+)"/g)) {
    const name = `lfs ${match[1]}`;
    add(name, 'lfs-registered', `lfs/commands/${file}`);
    for (const sub of text.matchAll(/NewCommand\("([\w-]+)"/g)) add(`${name} ${sub[1]}`, 'lfs-registered', `lfs/commands/${file}`);
  }
}
// Cobra supplies these commands; Git LFS's help dispatcher also handles man pages.
for (const name of ['help', 'completion']) {
  add(`lfs ${name}`, 'lfs-dispatcher', 'lfs/commands/run.go');
}
const completion = await cobraCompletion(lfsRoot, cobraRoot);
Object.assign(sources, completion.sources);
for (const name of completion.names) add(`lfs ${name}`, 'lfs-framework-helper', 'cobra/completions.go');
const output = {
  format: 1,
  baselines: { git: '2.55.0', lfs: '3.8.0', cobra: completion.version },
  scope: 'Version-pinned upstream commands, registered aliases/helpers, and companion programs. Site-installed git-* extensions cannot be enumerated globally.',
  extraction: 'Static registry extraction. Subcommand candidates are not evidence of audited scopes or constraints.',
  commands: [...entries.values()].sort((a, b) => a.command < b.command ? -1 : a.command > b.command ? 1 : 0),
  sources: Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)),
};
await writeFile(new URL('../spec/upstream/command-inventory.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(`Imported ${entries.size} command entries; no coverage state was promoted.`);
