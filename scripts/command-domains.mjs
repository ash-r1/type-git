import { scalarRepresentatives } from './scalar-domains.mjs';

/** Fixed structural representatives of normalized CLI state; not all possible CLI strings. */
export function commandDomains(spec, referencedKeys) {
  const domains = {};
  const add = (key, value) => {
    domains[key] ??= [undefined];
    if (!domains[key].some((old) => JSON.stringify(old) === JSON.stringify(value))) domains[key].push(value);
  };
  for (const [key, value] of Object.entries(spec.initial ?? {})) add(key, value);
  for (const option of [...Object.values(spec.options), ...(spec.numericOption ? [spec.numericOption] : [])]) {
    if (option.ignore) continue;
    if (option.toggle) add(option.key, false);
    for (const effect of option.effects ?? []) add(effect.key, effect.set);
    if (option.clear) { add(option.key, option.repeat ? [] : undefined); continue; }
    const values = option.allowed ? [...option.allowed] : option.value === 'flag' ? [option.set ?? true]
      : option.value === 'boolean' ? [false, true]
      : option.value.endsWith('integer') ? [-2, -1, 0, 1, 2]
      : ['', 'value', '0b', '1kb'];
    if (option.caseInsensitive && option.preserveCase) values.push(...values.filter(value => typeof value === 'string').map(value => value.toUpperCase()));
    if (option.value.startsWith('optional-')) values.push(option.set ?? true);
    for (const value of values) {
      if (option.repeat) {
        add(option.key, []);
        if (value !== false && !(option.skipEmpty && value === '')) {
          add(option.key, [value]);
          add(option.key, [value, value]);
        }
      } else add(option.key, value);
    }
  }
  domains.operands = [[], ['value'], ['value', 'value'], ['value', 'value', 'value'], ['value', 'value', 'value', 'value']];
  domains.operand0 = [undefined, 'value'];
  domains.inRepository = [undefined, false, true];
  const equalKeys = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.test === 'equalsKey') equalKeys.push([value.key, value.valueKey]);
    if (value.key && ['equals', 'notEquals'].includes(value.test)) add(value.key, value.value);
    if (value.key && value.test === 'startsWith') { add(value.key, value.value); add(value.key, value.value + 'value'); }
    if (value.key && value.test === 'lengthEquals') for (const size of [Math.max(0, value.value - 1), value.value, value.value + 1]) add(value.key, Array(size).fill('value'));
    if (value.kind === 'scalar') {
      const kinds = new Set((domains[value.key] ?? []).filter(item => item !== undefined).map(item => typeof item));
      for (const item of scalarRepresentatives(value.parser)) if (kinds.has(typeof item)) add(value.key, item);
    }
    if (value.kind === 'eachInteger') for (const item of [value.min - 1, value.min, value.min + 1]) { add(value.key, []); add(value.key, [item]); add(value.key, [value.min, item]); }
    if (value.kind === 'elements') {
      add(value.key, []);
      for (const allowed of value.allowed) { add(value.key, [allowed]); add(value.key, [allowed, allowed]); add(value.key, [allowed, 'invalid']); }
    }
    if (value.kind === 'value') for (const allowed of value.allowed) add(value.key, allowed);
    if (value.kind === 'range' || value.kind === 'integer') for (const number of [value.min - 1, value.min, value.min + 1]) add(value.key, number);
    if (value.kind === 'range' && value.max !== undefined) for (const number of [value.max - 1, value.max, value.max + 1]) add(value.key, number);
    if (value.kind === 'arity') for (const size of [0, value.min, Math.max(0, value.min - 1), (value.max ?? value.min) + 1]) add(value.key, Array(size).fill('value'));
    for (const child of Object.values(value)) visit(child);
  }
  spec.rules.forEach(visit);
  // Equality needs a shared vocabulary, including defaults and rule literals.
  // Iterate to a fixed point so transitive relations do not depend on declaration order.
  let changed;
  do {
    changed = false;
    for (const [left, right] of equalKeys) {
      const size = (domains[left]?.length ?? 0) + (domains[right]?.length ?? 0);
      for (const value of [...(domains[left] ?? [undefined]), ...(domains[right] ?? [undefined])]) {
        add(left, value);
        add(right, value);
      }
      changed ||= domains[left].length + domains[right].length !== size;
    }
  } while (changed);
  // Counts intentionally range over normalized states, not option-token permutations.
  // operand0 and operands are correlated in actual argv; avoid reporting a false
  // reachability proof for this over-approximation.
  for (const rule of spec.rules) for (const key of referencedKeys(rule)) domains[key] ??= key === 'hasSeparator' ? [undefined, true] : key === 'argumentTokens' || key === 'pathsAfterSeparator' || key === 'operandsBeforeSeparator' ? domains.operands : [undefined];
  return domains;
}
