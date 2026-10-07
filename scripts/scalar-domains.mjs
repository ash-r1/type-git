/** Fixed representatives for scalar validation; these do not enumerate infinite value languages. */
export function scalarRepresentatives(parser) {
  if (parser === 'object-filter' || parser === 'object-filter-auto') return ['', 'invalid', 'blob:none', 'auto', 'tree:0', 'tree:-1', 'combine:+'];
  if (parser === 'depth-initial') {
    const numbers = [-4294967295, -1, 0, 1, 2147483648, 4294967297];
    return [...numbers, ...numbers.map(String), '', '1suffix', '0x10'];
  }
  return [];
}
