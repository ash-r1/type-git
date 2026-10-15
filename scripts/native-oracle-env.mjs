/** Preserve host execution settings while letting each oracle declare its own Git inputs. */
export function nativeOracleBaseEnv(inherited = process.env) {
  return Object.fromEntries(Object.entries(inherited).filter(([name]) => !name.toUpperCase().startsWith('GIT_')));
}
