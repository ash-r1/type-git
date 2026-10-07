/** Convert pinned Git parse-options tables. Custom parsers require separate scopes. */
export function gitOptions(upstream, scopes, rules) {
  const tables = new Map(upstream.files.flatMap((file) => file.tables.map((table) => [`${file.file}:${table.function ?? 'global'}:${table.name}`, table])));
  const result = {};
  for (const [command, scope] of Object.entries(scopes)) {
    const definitions = scope.tables.flatMap((id) => {
      if (!tables.has(id)) throw new Error(`${command}: unknown option table ${id}`);
      return tables.get(id).options;
    });
    const options = {};
    const aliases = [];
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
      const base = { ...(parser ? { parser } : {}), key, value, ...(defaultString ? { set: JSON.parse(defaultString[0]) } : {}), ...(kind === 'OPTION_FILENAME' ? { emptyIsUnset: true } : {}), ...(kind === 'OPTION_COUNTUP' || fields.callback?.includes('parse_opt_string_list') || callback === 'recurse_submodules_cb' ? { repeat: true } : {}) };
      if (flags.includes('PARSE_OPT_CMDMODE')) base.modeGroup = fields.value;
      if (long) options[`--${long}`] = base;
      if (short) options[`${flags.includes('PARSE_OPT_NODASH') ? '' : '-'}${short}`] = base;
      if (long && !flags.includes('PARSE_OPT_NONEG')) {
        const negated = { ...base, value: 'flag', ...(noarg || parser ? { set: false } : { clear: true }) };
        options[long.startsWith('no-') ? `--${long.slice(3)}` : `--no-${long}`] = negated;
        if (long.startsWith('no-')) options[`--no-${long}`] = negated;
      }
    }
    for (const alias of aliases) {
      const match = alias.fields.value?.match(/"([^"]+)"/);
      const target = match && options[`--${match[1]}`];
      if (!target) throw new Error(`${command}: unresolved alias ${alias.long}`);
      options[`--${alias.long}`] = target;
      if (alias.short) options[`-${alias.short}`] = target;
      if (options[`--no-${match[1]}`]) options[`--no-${alias.long}`] = options[`--no-${match[1]}`];
    }
    // `--help` is intercepted by Git itself; `-h` can have a command-specific meaning.
    if (scope.optionParsing !== 'none') {
      options['--help'] = { key: 'help', value: 'flag' };
      if (!options['-h']) options['-h'] = { key: 'help', value: 'flag' };
    }
    Object.assign(options, scope.options ?? {});
    result[command] = { argv: command.split(' '), options, rules: rules[command] ?? [], source: scope.source, separator: scope.separator ?? true, ...(scope.optionParsing ? { optionParsing: scope.optionParsing } : {}) };
  }
  for (const command of Object.keys(rules)) if (!result[command]) throw new Error(`Rules for unknown Git scope: ${command}`);
  return result;
}
