import { readFileSync } from 'node:fs';
const { profiles } = JSON.parse(readFileSync(new URL('../spec/git-boolean-callbacks.json', import.meta.url), 'utf8'));

/** All normalized callback values for the CLI state model; not every input spelling. */
export function booleanDomain(parser) {
  if (typeof parser !== 'string' || !Object.hasOwn(profiles, parser)) return undefined;
  const profile = profiles[parser];
  return [...new Set([
    false, ...(profile.allowTrue ? [true] : []), ...Object.values(profile.names),
    ...Object.values(profile.transitions ?? {}).flatMap(({ from, to }) => [from, to]),
  ])];
}
