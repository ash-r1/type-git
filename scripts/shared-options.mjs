const dictionaryKeys = new Set(['options', 'argumentOptions', 'remainingOptions']);

/** Share exact readonly option definitions without changing catalogue values. */
export function sharedOptions(catalog) {
  const counts = new Map();
  const reserved = new Set();
  JSON.stringify(catalog, (key, value) => {
    reserved.add(key);
    if (typeof value === 'string') reserved.add(value);
    if (dictionaryKeys.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const option of Object.values(value)) {
        const json = JSON.stringify(option);
        counts.set(json, (counts.get(json) ?? 0) + 1);
      }
    }
    return value;
  });
  let index = 0;
  const profiles = new Map([...counts].filter(([, count]) => count > 1).map(([json]) => {
    let id;
    do { id = `sharedOption${index++}`; } while (reserved.has(id));
    return [json, id];
  }));
  const identifiers = new Set(profiles.values());
  return {
    profiles,
    /** Replace repeated dictionary entries with their allocated reference names. */
    replace(key, value) {
      if (!dictionaryKeys.has(key) || !value || typeof value !== 'object' || Array.isArray(value)) return value;
      return Object.fromEntries(Object.entries(value).map(([flag, option]) => [flag, profiles.get(JSON.stringify(option)) ?? option]));
    },
    /** Emit only allocated references as code, preserving existing string values. */
    unquote(text) {
      return text.replace(/"(sharedOption[0-9]+)"/g, (text, id) => identifiers.has(id) ? id : text);
    },
  };
}
