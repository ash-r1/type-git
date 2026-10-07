// Finite spelling resolution for Git 2.55 parse-options.c:parse_long_opt/register_abbrev.
// Values map to an existing canonical option; null records an ambiguous spelling.
export function parseOptionLongForms(definitions, abbreviate) {
  // preprocess_options copies the target's semantics but keeps the alias name
  // and its table position. Native alias_groups are PAIRS, not equivalence classes.
  const aliasPairs = [];
  const options = definitions.map(option => {
    if (option.kind !== 'OPTION_ALIAS') return option;
    const source = option.fields.value?.match(/"(?:\\.|[^"\\])*"/)?.[0];
    const name = source && JSON.parse(source);
    const target = definitions.find(candidate => candidate.long === name);
    if (!option.long || !name || !target) throw new Error(`Invalid native alias: ${option.long}`);
    if (target.kind === 'OPTION_ALIAS') throw new Error(`Nested native alias: ${option.long}`);
    aliasPairs.push([option.long, name]);
    return { ...target, long: option.long, short: option.short };
  }).filter(option => option.long && option.kind !== 'OPTION_SUBCOMMAND');
  const candidates = new Set(['n', 'no', 'no-']);
  for (const option of options) {
    const name = option.long.replace(/^no-/, '');
    for (let length = 0; length <= name.length; length++) {
      for (const prefix of ['', 'no-', 'no-no-']) {
        const word = prefix + name.slice(0, length);
        if (word) candidates.add(word);
      }
    }
  }
  function resolve(word, attached) {
    const raw = word + (attached ? '=' : '');
    let base = word;
    let unset = false;
    let doubleNo = false;
    if (base.startsWith('no-')) {
      base = base.slice(3);
      if (base.startsWith('no-')) { base = base.slice(3); doubleNo = true; }
      else unset = true;
    }
    let abbreviation;
    let ambiguous = false;
    const register = (value, option, flags) => {
      if (!abbreviate) return;
      const alias = abbreviation && aliasPairs.some(pair => pair.includes(abbreviation.name) && pair.includes(option.long));
      if (abbreviation && !(abbreviation.flags === flags && alias)) ambiguous = true;
      abbreviation = { value, name: option.long, flags };
    };
    for (const option of options) {
      const negatedName = option.long.startsWith('no-');
      const name = negatedName ? option.long.slice(3) : option.long;
      const allowUnset = !(option.fields.flags ?? '').includes('PARSE_OPT_NONEG');
      if (!negatedName && doubleNo) continue;
      const negated = unset !== negatedName;
      if (negated && !allowUnset) continue;
      const canonical = isUnset => `--${isUnset ? negatedName ? option.long.slice(3) : `no-${option.long}` : option.long}`;
      if (base === name) return canonical(negated);
      if (name.startsWith(base)) register(canonical(negated), option, Number(negated));
      // Git compares the full raw word here: an attached '=' changes --n/--no.
      // The very-short negation registration retains OPT_LONG; ordinary XOR
      // registration cancels it. Native alias comparison uses both flag bits.
      if (allowUnset && 'no-'.startsWith(raw)) register(canonical(!negatedName), option, 2 + Number(!negatedName));
    }
    return ambiguous ? null : abbreviation?.value;
  }
  const plain = {};
  const attached = {};
  for (const word of [...candidates].sort()) {
    for (const [hasValue, target] of [[false, plain], [true, attached]]) {
      const result = resolve(word, hasValue);
      if (result !== undefined) target[`--${word}`] = result;
    }
  }
  return { plain, attached };
}
