import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('spec/upstream/command-inventory.json', root), 'utf8'));
const audit = JSON.parse(await readFile(new URL('spec/command-audit.json', root), 'utf8'));
const exploration = JSON.parse(await readFile(new URL('docs/design/constraint-exploration.json', root), 'utf8'));
const cli = JSON.parse(await readFile(new URL('docs/design/command-exploration.json', root), 'utf8'));
const cliNames = new Set(cli.commands.map((entry) => entry.command));
const models = new Set(exploration.filter((r) => r.scope !== 'operands').map((r) => r.command));
const commands = new Map(inventory.commands.map((entry) => [entry.command, entry]));
for (const command of Object.keys(audit.commands)) {
  if (!commands.has(command)) commands.set(command, { command, classification: 'reviewed-scope', sources: [] });
}
const rows = [...commands.values()].sort((a, b) => a.command < b.command ? -1 : a.command > b.command ? 1 : 0);
for (const [command, record] of Object.entries(audit.commands)) {
  if (record.typedCommandAPI && !cliNames.has(command)) throw new Error(`${command}: missing typed command schema`);
  for (const model of record.models) if (!models.has(model)) throw new Error(`${command}: unknown model ${model}`);
  if (record.state === 'complete') {
    for (const facet of audit.facets) {
      if (!record.evidence?.[facet]?.length) throw new Error(`${command}: missing evidence for ${facet}`);
    }
    if (record.remaining) throw new Error(`${command}: complete with remaining work`);
  }
  for (const test of record.tests) await readFile(new URL(test, root));
}
const lines = ['# Upstream command coverage', '',
  `Baseline: Git ${inventory.baselines.git}; Git LFS ${inventory.baselines.lfs}.`, '',
  inventory.scope, '',
  '**Inventory is not implementation coverage.** Entries without an audit record are pending. A finite model count is not proof that upstream constraints were fully discovered.', '',
  `Inventory contains ${inventory.commands.length} entries; the table also includes individually reviewed operation scopes. Candidate nested dispatch names are retained in the JSON inventory, not counted as audited operations.`, '',
  '| Command / operation | Classification | Audit | Typed CLI | Models | Remaining work |',
  '| --- | --- | --- | --- | --- | --- |'];
for (const entry of rows) {
  const record = audit.commands[entry.command];
  lines.push(`| \`${entry.command}\` | ${entry.classification} | ${record?.state ?? 'pending'} | ${record?.typedCommandAPI ? 'yes' : 'pending'} | ${(record?.models ?? []).join(', ')} | ${record?.remaining ?? 'Audit every applicable facet.'} |`);
}
const text = lines.join('\n') + '\n';
const target = new URL('docs/design/command-coverage.md', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8').catch(() => '') !== text) throw new Error('Command coverage is stale; run pnpm constraints:generate');
} else await writeFile(target, text);
console.log(`Coverage ledger checked: ${rows.length} scopes, ${rows.filter((r) => audit.commands[r.command]?.state === 'complete').length} complete.`);
