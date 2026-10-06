import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const [sourceRoot] = process.argv.slice(2);
if (!sourceRoot) throw new Error('Usage: node scripts/import-lfs-options.mjs <git-lfs-3.8.0>');
if (!(await readFile(join(sourceRoot, 'config/version.go'), 'utf8')).includes('Version = "3.8.0"')) throw new Error('Expected Git LFS 3.8.0 sources');
const commands = {};
const hashes = {};
const sort = (a, b) => a < b ? -1 : a > b ? 1 : 0;
for (const file of (await readdir(join(sourceRoot, 'commands'))).filter((f) => f.startsWith('command_') && f.endsWith('.go') && !f.endsWith('_test.go')).sort()) {
  const text = await readFile(join(sourceRoot, 'commands', file), 'utf8');
  const registration = [...text.matchAll(/RegisterCommand\("([\w-]+)"/g)];
  if (registration.length === 0) continue;
  if (registration.length !== 1) throw new Error(`Review multiple command registrations: ${file}`);
  hashes[`commands/${file}`] = createHash('sha256').update(text).digest('hex');
  const name = `lfs ${registration[0][1]}`;
  const locals = new Map([['cmd', name]]);
  const children = [];
  for (const child of text.matchAll(/(?:(\w+)\s*:=\s*)?NewCommand\("([\w-]+)"/g)) {
    const fullName = `${name} ${child[2]}`;
    children.push(fullName);
    if (child[1]) locals.set(child[1], fullName);
  }
  for (const command of [name, ...children]) commands[command] = { argv: command.split(' '), options: {}, source: `https://github.com/git-lfs/git-lfs/blob/v3.8.0/commands/${file}`, separator: true };
  // All flag registrations at this pinned version use these single-line pflag calls.
  const calls = [...text.matchAll(/(\w+)\.(Flags|PersistentFlags)\(\)\.(\w+)\(([^\n]+)\)/g)];
  for (const [, variable, scope, method, args] of calls) {
    const command = locals.get(variable);
    if (!command) throw new Error(`Unknown flag owner ${variable} in ${file}`);
    const parsed = /^(Bool|String|StringSlice|Int|Int64)Var(P)?$/.exec(method);
    if (!parsed) throw new Error(`Review flag method ${method} in ${file}`);
    const fields = /^&[^,]+,\s*"([\w-]+)",\s*(?:"([^"]*)",\s*)?/.exec(args);
    if (!fields) throw new Error(`Cannot parse flag declaration ${file}: ${args}`);
    const key = fields[1];
    const short = parsed[2] ? fields[2] : undefined;
    const spec = { key, value: parsed[1] === 'Bool' ? 'boolean' : parsed[1].startsWith('Int') ? 'integer' : 'string', ...(parsed[1] === 'StringSlice' ? { repeat: true } : {}) };
    const targets = scope === 'PersistentFlags' ? [command, ...children] : [command];
    for (const target of targets) {
      commands[target].options[`--${key}`] = spec;
      if (short) commands[target].options[`-${short}`] = spec;
    }
  }
}
const run = await readFile(join(sourceRoot, 'commands/run.go'), 'utf8');
hashes['commands/run.go'] = createHash('sha256').update(run).digest('hex');
for (const name of ['lfs', 'lfs help', 'lfs completion']) commands[name] = { argv: name.split(' '), options: {}, source: 'https://github.com/git-lfs/git-lfs/blob/v3.8.0/commands/run.go', separator: true };
commands.lfs.options = { '--version': { key: 'version', value: 'boolean' }, '-v': { key: 'version', value: 'boolean' } };
for (const entry of Object.values(commands)) {
  entry.options['--help'] = { key: 'help', value: 'boolean' };
  entry.options['-h'] = { key: 'help', value: 'boolean' };
  entry.options = Object.fromEntries(Object.entries(entry.options).sort(([a], [b]) => sort(a, b)));
}
const result = { baseline: '3.8.0', extraction: 'Cobra/pflag registrations, including short aliases and inherited persistent flags. This inventory does not infer semantic constraints.', sources: hashes, commands: Object.fromEntries(Object.entries(commands).sort(([a], [b]) => sort(a, b))) };
await writeFile(new URL('../spec/upstream/lfs-options.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`Imported ${Object.keys(commands).length} LFS command scopes.`);
