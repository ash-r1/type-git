import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('spec/upstream/command-inventory.json', root), 'utf8'));
const audit = JSON.parse(await readFile(new URL('spec/command-audit.json', root), 'utf8'));
const exploration = JSON.parse(await readFile(new URL('docs/design/constraint-exploration.json', root), 'utf8'));
const cli = JSON.parse(await readFile(new URL('docs/design/command-exploration.json', root), 'utf8'));
const cliNames = new Set(cli.commands.map((entry) => entry.command));
const models = new Set(exploration.filter((r) => r.scope !== 'operands').map((r) => r.command));
const commands = new Map(inventory.commands.map((entry) => [entry.command, entry]));
if (commands.size !== inventory.commands.length) throw new Error('Duplicate upstream inventory entries');
const sourcedLibraries = new Set(['sh-i18n', 'sh-setup']);
for (const { command } of inventory.commands) {
  const record = audit.commands[command];
  if (!record) throw new Error(`${command}: upstream inventory entry has no audit record`);
  if (record.apiApplicability === 'sourced-library') {
    if (!sourcedLibraries.has(command) || record.typedCommandAPI) throw new Error(`${command}: invalid sourced-library exclusion`);
  } else if (!record.typedCommandAPI) throw new Error(`${command}: upstream executable lacks a typed CLI scope`);
}
for (const command of cliNames) {
  if (!audit.commands[command]?.typedCommandAPI) throw new Error(`${command}: generated CLI scope lacks an audit record`);
}

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
const summary = {
  baselines: inventory.baselines,
  inventoryEntries: inventory.commands.length,
  inventoryTypedCLI: inventory.commands.filter(({ command }) => audit.commands[command]?.typedCommandAPI).length,
  sourcedLibraries: inventory.commands.filter(({ command }) => audit.commands[command]?.apiApplicability === 'sourced-library').map(({ command }) => command),
  typedScopes: cliNames.size,
  auditedScopes: rows.length,
  completeConstraintAudits: rows.filter(({ command }) => audit.commands[command]?.state === 'complete').length,
  finalRules: cli.commands.reduce((sum, entry) => sum + entry.rules, 0),
  callbackTransitions: cli.commands.reduce((sum, entry) => sum + (entry.transitions?.length ?? 0), 0),
  interpretation: 'Typed API coverage is separate from upstream constraint completeness. Exploration is exact only over the declared finite normalized-state domains, not over all argv or repository states.',
};
const summaryText = JSON.stringify(summary, null, 2) + '\n';
const summaryTarget = new URL('docs/design/command-coverage.json', root);
if (process.argv.includes('--check')) {
  if (await readFile(summaryTarget, 'utf8').catch(() => '') !== summaryText) throw new Error('Command coverage summary is stale; run pnpm constraints:generate');
} else await writeFile(summaryTarget, summaryText);
const lines = ['# Upstream command coverage', '',
  `Baseline: Git ${inventory.baselines.git}; Git LFS ${inventory.baselines.lfs}; Cobra ${inventory.baselines.cobra}.`, '',
  inventory.scope, '',
  '**Inventory is not implementation coverage.** Entries without an audit record are pending. A finite model count is not proof that upstream constraints were fully discovered.', '',
  `Inventory contains ${inventory.commands.length} entries; the table also includes individually reviewed operation scopes. Candidate nested dispatch names are retained in the JSON inventory, not counted as audited operations.`, '',
  `Typed inventory entries: ${summary.inventoryTypedCLI}/${summary.inventoryEntries}; sourced-library exclusions: ${summary.sourcedLibraries.length}. Total typed operation scopes: ${summary.typedScopes}. Completed constraint audits: ${summary.completeConstraintAudits}.`, '',
  '| Command / operation | Classification | Audit | Typed CLI | Models | Remaining work |',
  '| --- | --- | --- | --- | --- | --- |'];
for (const entry of rows) {
  const record = audit.commands[entry.command];
  lines.push(`| \`${entry.command}\` | ${entry.classification} | ${record?.state ?? 'pending'} | ${record?.apiApplicability === 'sourced-library' ? 'n/a (sourced library)' : record?.typedCommandAPI ? 'yes' : 'pending'} | ${(record?.models ?? []).join(', ')} | ${record?.remaining ?? 'Audit every applicable facet.'} |`);
}
const text = lines.join('\n') + '\n';
const target = new URL('docs/design/command-coverage.md', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8').catch(() => '') !== text) throw new Error('Command coverage is stale; run pnpm constraints:generate');
} else await writeFile(target, text);
console.log(`Coverage ledger checked: ${rows.length} scopes, ${rows.filter((r) => audit.commands[r.command]?.state === 'complete').length} complete.`);
