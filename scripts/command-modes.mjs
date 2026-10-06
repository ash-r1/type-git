/** Exhaustive one-token transitions for the declarative native CMDMODE machine.
 * This is independent of final-state constraints and does not claim argv reachability.
 */
export function commandModes(spec) {
  const groups = new Map();
  for (const [flag, option] of Object.entries(spec.options)) {
    if (!option.modeGroup) continue;
    const tokens = groups.get(option.modeGroup) ?? [];
    const mode = value => value === false || value === undefined ? false : option.modeFromValue ? value : (option.modeValue ?? option.key);
    if (option.modeFromValue) {
      if (!option.allowed) throw new Error(`${flag}: mode callbacks need a finite declared value domain`);
      if (option.value.startsWith('optional-')) tokens.push({ flag, mode: mode(option.set ?? true) });
      for (const value of option.allowed) tokens.push({ flag, value, mode: mode(value) });
    } else {
      tokens.push({ flag, mode: mode(option.clear ? undefined : (option.set ?? true)) });
    }
    groups.set(option.modeGroup, tokens);
  }
  return [...groups].map(([group, tokens]) => {
    const states = [null, ...new Set(tokens.map(token => token.mode).filter(mode => mode !== false))];
    const transitions = states.map(from => ({ from, acceptedTokens: tokens.flatMap((token, index) => from === null || from === token.mode ? [index] : []) }));
    return { group, tokens, total: states.length * tokens.length, accepted: transitions.reduce((sum, t) => sum + t.acceptedTokens.length, 0), transitions };
  });
}
