import ts from 'typescript';
import { scalarRepresentatives } from './scalar-domains.mjs';
import { commandDomains } from './command-domains.mjs';
import { commandModes } from './command-modes.mjs';
import { literal } from './constraint-domains.mjs';
import { gitOptions } from './git-options.mjs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = new URL('../', import.meta.url);
const upstream = JSON.parse(await readFile(new URL('spec/upstream/lfs-options.json', root), 'utf8'));
const additional = JSON.parse(await readFile(new URL('spec/lfs-command-rules.json', root), 'utf8'));
const temp = await mkdtemp(join(tmpdir(), 'type-git-cli-spec-'));
try {
  await writeFile(join(temp, 'package.json'), '{"type":"module"}');
  for (const name of ['commands', 'inputs', 'model', 'scalars', 'git-scalars', 'ascii', 'git-boolean', 'boolean-callbacks.generated', 'git-integer', 'git-decimal', 'numeric-callbacks.generated', 'object-filter', 'decision-diagram']) {
    const source = await readFile(new URL(`src/constraints/${name}.ts`, root), 'utf8');
    await writeFile(join(temp, `${name}.js`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  }
  const { COMMAND_CONSTRAINTS } = await import(pathToFileURL(join(temp, 'commands.js')));
  const { INPUT_CONSTRAINTS } = await import(pathToFileURL(join(temp, 'inputs.js')));
  const { parseGitScalar } = await import(pathToFileURL(join(temp, 'git-scalars.js')));
  const { solve } = await import(pathToFileURL(join(temp, 'decision-diagram.js')));
  const { referencedKeys } = await import(pathToFileURL(join(temp, 'model.js')));
  const mappings = { 'lfs checkout': 'lfsCheckout', 'lfs locks': 'lfsLocks', 'lfs migrate info': 'lfsMigrateInfo', 'lfs migrate import': 'lfsMigrateImport', 'lfs migrate export': 'lfsMigrateExport' };
  const renameKey = (key) => ['patterns', 'refs', 'files'].includes(key) ? 'operands' : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  function rename(value) {
    if (Array.isArray(value)) return value.map(rename);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
      key === 'key' ? renameKey(child) : key === 'keys' ? child.map(renameKey) : rename(child),
    ]));
    return value;
  }
  const native = JSON.parse(await readFile(new URL('spec/upstream/git-option-tables.json', root), 'utf8'));
  const scopes = JSON.parse(await readFile(new URL('spec/git-command-scopes.json', root), 'utf8'));
  const nativeRules = JSON.parse(await readFile(new URL('spec/git-command-rules.json', root), 'utf8'));
  const groups = JSON.parse(await readFile(new URL('spec/git-option-groups.json', root), 'utf8'));
  for (const frontend of ['p4', 'svn']) {
    const snapshot = JSON.parse(await readFile(new URL(`spec/upstream/${frontend}-options.json`, root), 'utf8'));
    for (const [name, entry] of Object.entries(snapshot.commands)) {
      if (!scopes[name]) throw new Error(`Missing scope for extracted ${frontend} operation ${name}`);
      scopes[name] = { ...scopes[name], options: { ...entry.options, ...scopes[name].options } };
    }
  }
  const catalog = gitOptions(native, scopes, nativeRules, groups, JSON.parse(await readFile(new URL('spec/upstream/git-numeric-options.json', root), 'utf8')), JSON.parse(await readFile(new URL('spec/git-numeric-callbacks.json', root), 'utf8')));
  for (const [name, entry] of Object.entries(upstream.commands)) {
    const inherited = mappings[name] ? COMMAND_CONSTRAINTS[mappings[name]].filter((r) => r.origin === 'git' && r.kind !== 'unsupported').map(rename) : [];
    if (name === 'lfs checkout') inherited.push(...INPUT_CONSTRAINTS.lfsCheckout.map(rename));
    const rules = [...inherited, ...(additional[name] ?? [])];
    if (entry.minimumOperands !== undefined) rules.push({ id: `cli.${name.replaceAll(' ', '.')}.operands`, kind: 'arity', key: 'operands', min: entry.minimumOperands, origin: 'git', reason: 'The completion helper requires at least one literal argument, including an empty fragment.', source: entry.source });
    const keys = new Set(['argumentTokens', 'operands', 'operand0', 'inRepository', 'hasSeparator', 'operandsBeforeSeparator', 'pathsAfterSeparator', ...Object.keys(entry.initial ?? {}), ...[...Object.values(entry.options), ...(entry.numericOption ? [entry.numericOption] : [])].flatMap((opt) => [opt.key, ...(opt.effects ?? []).map(effect => effect.key)])]);
    for (const rule of rules) for (const key of referencedKeys(rule)) if (!keys.has(key)) throw new Error(`${name}: rule ${rule.id} refers to unknown input ${key}`);
    const { minimumOperands: _minimumOperands, ...entrySpec } = entry;
    catalog[name] = { ...entrySpec, options: Object.fromEntries(Object.entries(entry.options).map(([flag, opt]) => [flag, opt.repeat ? { ...opt, skipEmpty: true } : opt])), rules };
  }
  for (const name of Object.keys(additional)) if (!catalog[name]) throw new Error(`Rules for unknown command ${name}`);
  for (const [name, entry] of Object.entries(catalog)) {
    const keys = new Set(['argumentTokens', 'operands', 'operand0', 'inRepository', 'hasSeparator', 'operandsBeforeSeparator', 'pathsAfterSeparator', ...Object.keys(entry.initial ?? {}), ...[...Object.values(entry.options), ...(entry.numericOption ? [entry.numericOption] : [])].flatMap((opt) => [opt.key, ...(opt.effects ?? []).map(effect => effect.key)])]);
    for (const rule of entry.rules) for (const key of referencedKeys(rule)) if (!keys.has(key)) throw new Error(`${name}: rule ${rule.id} refers to unknown input ${key}`);
    for (const option of [...Object.values(entry.options), ...(entry.numericOption ? [entry.numericOption] : [])]) for (const rule of option.checks ?? []) for (const key of referencedKeys(rule)) if (key !== '$value' && key !== '$remaining' && !keys.has(key)) throw new Error(`${name}: transition ${rule.id} refers to unknown input ${key}`);
  }
  for (const [name, entry] of Object.entries(catalog)) {
    for (const flag of entry.parserExit?.exceptFirst ?? []) if (!entry.parserExit.flags.includes(flag)) throw new Error(`${name} ${flag}: excluded first token must be a parser exit`);
    for (const flag of entry.parserExit?.flags ?? []) {
      const option = entry.options[flag];
      if (!option || option.key !== 'help' || option.value !== 'flag' || option.before !== undefined || option.parser || option.checks?.length || option.effects?.length || option.modeGroup) throw new Error(`${name} ${flag}: parser exit must be a plain help flag`);
    }
    for (const [flag, option] of Object.entries(entry.options)) if (option.emptyValueFlag) {
      const target = entry.options[option.emptyValueFlag];
      if (flag.startsWith('--') || !option.emptyValueFlag.startsWith('--') || !option.value.startsWith('optional-') || !target || target.key !== option.key || target.value !== option.value) throw new Error(`${name} ${flag}: invalid empty-value alias`);
    }
    const keys = new Set([...Object.keys(entry.initial ?? {}), ...Object.values(entry.options).flatMap(option => [option.key, ...(option.effects ?? []).map(effect => effect.key)])]);
    for (const [flag, option] of Object.entries(entry.options)) for (const effect of option.effects ?? []) for (const predicate of effect.when?.all ?? []) {
      for (const key of [predicate.key, ...(predicate.valueKey ? [predicate.valueKey] : [])]) if (!keys.has(key)) throw new Error(`${name} ${flag}: effect refers to unknown input ${key}`);
    }
  }
  for (const [name, spec] of Object.entries(catalog)) for (const [word, target] of Object.entries(spec.dispatch ?? {})) {
    if (!catalog[target] || target !== `${name} ${word}` || catalog[target].executable !== spec.executable) throw new Error(`${name}: invalid dispatch target ${word}: ${target}`);
  }
  // Keep each inferred literal type below TypeScript's declaration serialization
  // limit. The registry references these types instead of expanding every schema.
  const entries = Object.entries(catalog).map(([name, spec], index) => ({ name, spec, identifier: `commandSpec${index}` }));
  const declarations = entries.map(({ spec, identifier }) => `const ${identifier} = ${JSON.stringify(spec, null, 2)} as const satisfies CommandSpec;`).join('\n');
  const registryType = entries.map(({ name, identifier }) => `readonly ${JSON.stringify(name)}: typeof ${identifier};`).join('\n');
  const registryValues = entries.map(({ name, identifier }) => `${JSON.stringify(name)}: ${identifier},`).join('\n');
  const unformatted = `// Generated by pnpm commands:generate. Do not edit.\nimport type { CommandSpec } from './spec.js';\n\n${declarations}\nexport const COMMAND_SPECS: {\n${registryType}\n} = {\n${registryValues}\n};\n`;
  const formatted = spawnSync(process.execPath, [require.resolve('@biomejs/biome/bin/biome'), 'format', '--files-max-size=16777216', '--stdin-file-path=src/commands/generated.ts'], { input: unformatted, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (formatted.status !== 0) throw new Error(formatted.stderr);
  const content = formatted.stdout;
  if (!content.includes('export const COMMAND_SPECS:')) throw new Error(`Formatter produced no command catalogue: ${formatted.stderr}`);
  // Format without requiring the compiler in runtime packages.
  const target = new URL('src/commands/generated.ts', root);
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8').catch(() => '') !== content) throw new Error('Command specs are stale; run pnpm commands:generate');
  } else await writeFile(target, content);
  const numericProfiles = new Map();
  const numericScopes = [];
  for (const [command, spec] of Object.entries(catalog)) {
    const options = [];
    for (const [flag, option] of [...Object.entries(spec.options), ...(spec.numericOption ? [['-<digits>', spec.numericOption]] : [])]) {
      if (typeof option.parser !== 'object') continue;
      const id = option.parser.kind === 'decimal' ? `decimal:${JSON.stringify(option.parser)}` : `${option.parser.signed ? 'signed' : 'unsigned'}-${option.parser.bits}`;
      if (!numericProfiles.has(id)) numericProfiles.set(id, {
        parser: option.parser,
        cases: scalarRepresentatives(option.parser).map(value => {
          const result = parseGitScalar(option.parser, value);
          return { input: literal(value), valid: result.valid, ...(result.valid ? { normalized: literal(result.value) } : {}) };
        }),
      });
      options.push({ flag, key: option.key, profile: id, ...(option.set !== undefined ? { default: option.set } : {}) });
    }
    if (options.length) numericScopes.push({ command, options });
  }
  const numericReport = JSON.stringify({
    scope: 'Deterministic boundary representatives for compiler-recorded integer handlers and source-audited numeric callbacks, not exhaustive command semantics.',
    source: 'https://github.com/git/git/blob/v2.55.0/parse-options.c',
    snapshot: 'spec/upstream/git-numeric-options.json',
    callbacks: 'spec/git-numeric-callbacks.json',
    profiles: Object.fromEntries(numericProfiles), commands: numericScopes,
  }, null, 2) + '\n';
  const numericTarget = new URL('docs/design/native-integer-exploration.json', root);
  if (process.argv.includes('--check')) {
    if (await readFile(numericTarget, 'utf8').catch(() => '') !== numericReport) throw new Error('Integer parser exploration is stale; run pnpm commands:generate');
  } else await writeFile(numericTarget, numericReport);
  const exploration = Object.entries(catalog).map(([command, spec]) => {
    const domains = commandDomains(spec, referencedKeys);
    const result = solve(spec.rules, domains);
    const transitions = [...Object.entries(spec.options), ...(spec.numericOption ? [['-<digits>', spec.numericOption]] : [])].filter(([, option]) => option.checks?.length).map(([flag, option]) => {
      const transition = { ...spec, options: { ...spec.options, $incoming: { ...option, key: '$value', repeat: false, effects: [] } }, rules: option.checks };
      const referenced = new Set(option.checks.flatMap(referencedKeys));
      const domains = Object.fromEntries(Object.entries(commandDomains(transition, referencedKeys)).filter(([key]) => referenced.has(key)));
      const result = solve(option.checks, domains);
      return { flag, rules: option.checks.map(rule => rule.id), domains: Object.fromEntries(Object.entries(domains).map(([key, values]) => [key, values.map(literal)])), total: String(result.total), accepted: String(result.accepted), isolatedRuleWitnesses: Object.fromEntries(Object.entries(result.counterexamples).map(([id, witness]) => [id, witness === undefined ? null : literal(witness)])) };
    });
    const modes = commandModes(spec);
    return { command, ...(spec.parserExit ? { parserExit: spec.parserExit } : {}), ...(spec.executable ? { executable: spec.executable } : {}), ...(spec.dispatch ? { dispatch: spec.dispatch } : {}), ...(modes.length ? { modes } : {}), ...(transitions.length ? { transitions } : {}), rules: spec.rules.length, domains: Object.fromEntries(Object.entries(domains).map(([key, values]) => [key, values.map(literal)])), total: String(result.total), accepted: String(result.accepted), nodes: result.nodes.length, isolatedRuleWitnesses: Object.fromEntries(Object.entries(result.counterexamples).map(([id, witness]) => [id, witness === undefined ? null : literal(witness)])) };
  });
  const report = JSON.stringify({ scope: 'Exact finite normalized-state counts. Domains over-approximate argv-reachable states; counts do not prove upstream completeness or reachability. No random sampling.', commands: exploration }, null, 2) + '\n';
  const reportPath = new URL('docs/design/command-exploration.json', root);
  if (process.argv.includes('--check')) {
    if (await readFile(reportPath, 'utf8').catch(() => '') !== report) throw new Error('Command exploration is stale; run pnpm commands:generate');
  } else await writeFile(reportPath, report);
  console.log(`Generated/checked ${Object.keys(catalog).length} typed command specifications.`);
} finally { await rm(temp, { recursive: true, force: true }); }
