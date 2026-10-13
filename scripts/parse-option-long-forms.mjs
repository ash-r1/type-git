// Finite spelling resolution for Git 2.55 parse-options.c:parse_long_opt/register_abbrev.
// Values map to an existing canonical option; null records an ambiguous spelling.
export function parseOptionLongForms(definitions, abbreviate) {
  if (definitions.some(option => option.kind === 'OPTION_ALIAS')) throw new Error('Long-form compilation requires explicit alias-family support for this table');
  const options = definitions.filter(option => option.long && option.kind !== 'OPTION_SUBCOMMAND');
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
    const register = value => {
      if (!abbreviate) return;
      // No alias families in the audited input tables. Even a second registration
      // of the same option is ambiguous in native register_abbrev.
      if (abbreviation !== undefined) ambiguous = true;
      abbreviation = value;
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
      if (name.startsWith(base)) register(canonical(negated));
      // Git compares the full raw word here: an attached '=' changes --n/--no.
      if (allowUnset && 'no-'.startsWith(raw)) register(canonical(!negatedName));
    }
    return ambiguous ? null : abbreviation;
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
