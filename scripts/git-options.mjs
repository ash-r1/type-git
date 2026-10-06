/** Convert pinned Git parse-options tables. Custom parsers require separate scopes. */
export function gitOptions(upstream, scopes, rules, groups = {}) {
  const candidates = new Map();
  for (const file of upstream.files) for (const table of file.tables) {
    const id = `${file.file}:${table.function ?? 'global'}:${table.name}`;
    candidates.set(id, [...(candidates.get(id) ?? []), table]);
  }
  const tables = new Map();
  for (const [id, entries] of candidates) {
    if (entries.length === 1) tables.set(id, entries[0]);
    entries.forEach((entry, index) => tables.set(`${id}#${index + 1}`, entry));
  }
  const definitionsFor = (ids, command) => ids.flatMap(id => {
    if (!tables.has(id)) throw new Error(`${command}: unknown or ambiguous option table ${id}; use #1/#2 for repeated declarations`);
    return tables.get(id).options;
  });
  const result = {};
  for (const [command, scope] of Object.entries(scopes)) {
    const definitions = definitionsFor(scope.tables, command);
    const options = tableOptions(definitions, command);
    // `--help` is intercepted by Git itself; `-h` can have a command-specific meaning.
    if (scope.optionParsing !== 'none') {
      options['--help'] = { key: 'help', value: 'flag' };
      if (!options['-h']) options['-h'] = { key: 'help', value: 'flag' };
    }
    const inherited = (scope.optionGroups ?? []).map(name => {
      if (!groups[name]) throw new Error(`${command}: unknown option group ${name}`);
      return groups[name];
    });
    for (const group of inherited) Object.assign(options, group.options);
    if (scope.inheritedOptionMarker) for (const [flag, option] of Object.entries(options)) {
      options[flag] = { ...option, effects: [...(option.effects ?? []), { key: scope.inheritedOptionMarker, set: true }] };
    }
    Object.assign(options, tableOptions(definitionsFor(scope.finalTables ?? [], command), command));
    Object.assign(options, scope.options ?? {});
    for (const flag of scope.omitOptions ?? []) delete options[flag];
    result[command] = { argv: command.split(' '), ...(scope.initial ? { initial: scope.initial } : {}), options, rules: [...inherited.flatMap(group => group.rules ?? []), ...(rules[command] ?? [])], source: scope.source, separator: scope.separator ?? true, ...(scope.optionParsing ? { optionParsing: scope.optionParsing } : {}) };
  }
  for (const command of Object.keys(rules)) if (!result[command]) throw new Error(`Rules for unknown Git scope: ${command}`);
  return result;
}

function tableOptions(definitions, command) {
    const options = {};
    const aliases = [];
    const negations = {};
    for (const definition of definitions) {
      const { kind, long, short, fields } = definition;
      const flags = fields.flags ?? '';
      if (kind === 'OPTION_SUBCOMMAND') continue;
      if (kind === 'OPTION_ALIAS') { aliases.push(definition); continue; }
      if (kind === 'OPTION_NUMBER') throw new Error(`${command}: numeric shorthand needs an explicit grammar`);
      const key = long ?? short;
      if (!key) throw new Error(`${command}: unnamed ${kind}`);
      const noarg = flags.includes('PARSE_OPT_NOARG');
      const optional = flags.includes('PARSE_OPT_OPTARG') || flags.includes('PARSE_OPT_LASTARG_DEFAULT');
      const numeric = ['OPTION_INTEGER', 'OPTION_UNSIGNED'].includes(kind);
      const value = noarg ? 'flag' : `${optional ? 'optional-' : ''}${numeric ? 'integer' : 'string'}`;
      const defaultString = optional && fields.defval?.match(/"(?:\\.|[^"\\])*"/);
      const callback = (fields.callback ?? '').replace(/[&()]/g, '');
      const parser = { option_fetch_parse_recurse_submodules: 'fetch-recurse', option_parse_push_signed: 'push-signed', option_parse_recurse_submodules: 'push-recurse' }[callback];
      const base = { ...(parser ? { parser } : {}), key, value, ...(defaultString ? { set: JSON.parse(defaultString[0]) } : {}), ...(kind === 'OPTION_FILENAME' ? { emptyIsUnset: true } : {}), ...(kind === 'OPTION_COUNTUP' || fields.callback?.includes('parse_opt_string_list') || ['recurse_submodules_cb', 'parse_opt_strvec'].includes(callback) ? { repeat: true } : {}) };
      if (flags.includes('PARSE_OPT_CMDMODE')) base.modeGroup = fields.value;
      if (long) options[`--${long}`] ??= base;
      if (short) options[`${flags.includes('PARSE_OPT_NODASH') ? '' : '-'}${short}`] ??= base;
      if (long && !flags.includes('PARSE_OPT_NONEG')) {
        const negated = { ...base, value: 'flag', ...(kind === 'OPTION_FILENAME' ? { ignore: true } : noarg || parser ? { set: false } : { clear: true }) };
        negations[long.startsWith('no-') ? `--${long.slice(3)}` : `--no-${long}`] ??= negated;
        if (long.startsWith('no-')) negations[`--no-${long}`] ??= negated;
      }
    }
    for (const [flag, option] of Object.entries(negations)) options[flag] ??= option;
    for (const alias of aliases) {
      const match = alias.fields.value?.match(/"([^"]+)"/);
      const target = match && options[`--${match[1]}`];
      if (!target) throw new Error(`${command}: unresolved alias ${alias.long}`);
      options[`--${alias.long}`] ??= target;
      if (alias.short) options[`-${alias.short}`] ??= target;
      if (options[`--no-${match[1]}`]) options[`--no-${alias.long}`] ??= options[`--no-${match[1]}`];
    }
    return options;
}
