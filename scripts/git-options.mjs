/** Convert pinned Git parse-options tables. Custom parsers require separate scopes. */
export function gitOptions(upstream, scopes, rules, groups = {}, numericSnapshot, callbacks = { profiles: {} }) {
  const resolve = option => callbacks.profiles[option.parser] ? { ...option, parser: callbacks.profiles[option.parser].parser } : option;
  const numeric = new Map((numericSnapshot?.options ?? []).map(row => [JSON.stringify([row.file, row.function, row.table, row.flag, row.kind]), row]));
  const candidates = new Map();
  for (const file of upstream.files) for (const table of file.tables) {
    const id = `${file.file}:${table.function ?? 'global'}:${table.name}`;
    const options = table.options.map(option => {
      if (!['OPTION_INTEGER', 'OPTION_UNSIGNED'].includes(option.kind)) return { ...option, file: file.file };
      const metadata = numeric.get(JSON.stringify([file.file, table.function ?? null, table.name, option.long ?? option.short, option.kind]));
      if (!metadata) throw new Error(`Missing compiler-evaluated integer metadata: ${id} ${option.long ?? option.short}`);
      return { ...option, numeric: metadata, file: file.file };
    });
    candidates.set(id, [...(candidates.get(id) ?? []), { ...table, options }]);
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
    const options = tableOptions(definitions, command, scope.numericOption, callbacks);
    // `--help` is intercepted by Git itself; `-h` can have a command-specific meaning.
    if (scope.optionParsing !== 'none') {
      options['--help'] = { key: 'help', value: 'flag' };
      if (!options['-h']) options['-h'] = { key: 'help', value: 'flag' };
    }
    const inherited = (scope.optionGroups ?? []).map(name => {
      if (!groups[name]) throw new Error(`${command}: unknown option group ${name}`);
      return groups[name];
    });
    for (const group of inherited) Object.assign(options, Object.fromEntries(Object.entries(group.options).map(([flag, option]) => [flag, resolve(option)])));
    if (scope.inheritedOptionMarker) for (const [flag, option] of Object.entries(options)) {
      options[flag] = { ...option, effects: [...(option.effects ?? []), { key: scope.inheritedOptionMarker, set: true }] };
    }
    Object.assign(options, tableOptions(definitionsFor(scope.finalTables ?? [], command), command, scope.numericOption, callbacks));
    for (const [flag, override] of Object.entries(scope.options ?? {})) {
      if (scope.omitOptions?.includes(flag) || (scope.optionAllowlist && !scope.optionAllowlist.includes(flag))) continue;
      if (options[flag]?.parser?.kind === 'integer' && JSON.stringify(resolve(override).parser) !== JSON.stringify(options[flag].parser)) {
        throw new Error(`${command} ${flag}: scope override drops or changes compiler-recorded integer metadata`);
      }
    }
    Object.assign(options, Object.fromEntries(Object.entries(scope.options ?? {}).map(([flag, option]) => [flag, resolve(option)])));
    if (scope.optionAllowlist) for (const flag of Object.keys(options)) {
      if (!scope.optionAllowlist.includes(flag)) delete options[flag];
    }
    for (const flag of scope.omitOptions ?? []) delete options[flag];
    result[command] = { argv: command.split(' '), ...(scope.executable ? { executable: scope.executable } : {}), ...(scope.dispatch ? { dispatch: scope.dispatch } : {}), ...(scope.initial ? { initial: scope.initial } : {}), options, ...(scope.numericOption ? { numericOption: resolve(scope.numericOption) } : {}), rules: [...inherited.flatMap(group => group.rules ?? []), ...(rules[command] ?? [])], source: scope.source, separator: scope.separator ?? true, ...(scope.optionParsing ? { optionParsing: scope.optionParsing } : {}) };
  }
  for (const command of Object.keys(rules)) if (!result[command]) throw new Error(`Rules for unknown Git scope: ${command}`);
  return result;
}

function tableOptions(definitions, command, numericOption, callbacks) {
    const options = {};
    const aliases = [];
    const negations = {};
    for (const definition of definitions) {
      const { kind, long, short, fields } = definition;
      const flags = fields.flags ?? '';
      if (kind === 'OPTION_SUBCOMMAND') continue;
      if (kind === 'OPTION_ALIAS') { aliases.push(definition); continue; }
      if (kind === 'OPTION_NUMBER') {
        if (!numericOption) throw new Error(`${command}: numeric shorthand needs an explicit grammar`);
        continue;
      }
      const key = long ?? short;
      if (!key) throw new Error(`${command}: unnamed ${kind}`);
      const noarg = flags.includes('PARSE_OPT_NOARG');
      const optional = flags.includes('PARSE_OPT_OPTARG') || flags.includes('PARSE_OPT_LASTARG_DEFAULT');
      const numeric = ['OPTION_INTEGER', 'OPTION_UNSIGNED'].includes(kind);
      let value = noarg ? 'flag' : `${optional ? 'optional-' : ''}${numeric ? 'integer' : 'string'}`;
      const defaultString = optional && fields.defval?.match(/"(?:\\.|[^"\\])*"/);
      const callback = (fields.callback ?? '').replace(/[&()]/g, '');
      let parser = numeric ? { kind: 'integer', signed: kind === 'OPTION_INTEGER', bits: definition.numeric.bits } : { opt_parse_list_objects_filter: 'object-filter', option_fetch_parse_recurse_submodules: 'fetch-recurse', option_parse_push_signed: 'push-signed', option_parse_recurse_submodules: 'push-recurse' }[callback];
      const numericCallback = Object.values(callbacks.profiles).find(profile => profile.callbacks.some(entry => entry.name === callback && (!entry.file || entry.file === definition.file)));
      if (numericCallback) {
        parser = numericCallback.parser;
        value = `${optional ? 'optional-' : ''}integer`;
      }
      const base = { ...(parser ? { parser } : {}), key, value, ...(numeric && optional ? { set: definition.numeric.default } : {}), ...(defaultString ? { set: JSON.parse(defaultString[0]) } : {}), ...(kind === 'OPTION_FILENAME' ? { emptyIsUnset: true } : {}), ...(kind === 'OPTION_COUNTUP' || fields.callback?.includes('parse_opt_string_list') || ['recurse_submodules_cb', 'parse_opt_strvec'].includes(callback) ? { repeat: true } : {}) };
      if (flags.includes('PARSE_OPT_CMDMODE')) {
        base.modeGroup = fields.value.replace(/[()\s]/g, '');
        if (kind === 'OPTION_SET_INT' && fields.defval) base.modeValue = fields.defval.replace(/[()\s]/g, '');
      }
      if (long) options[`--${long}`] ??= base;
      if (short) options[`${flags.includes('PARSE_OPT_NODASH') ? '' : '-'}${short}`] ??= optional && long ? { ...base, emptyValueFlag: `--${long}` } : base;
      if (long && !flags.includes('PARSE_OPT_NONEG')) {
        const negated = { ...base, value: 'flag', ...(numeric || numericCallback ? { set: 0, ...(parser.positive ? { parser: undefined } : {}) } : kind === 'OPTION_FILENAME' ? { ignore: true } : noarg || (parser && parser !== 'object-filter') ? { set: false } : { clear: true }) };
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
