/** Fixed representatives for scalar validation; these do not enumerate infinite value languages. */
export function scalarRepresentatives(parser) {
  if (typeof parser === 'object' && parser.kind === 'decimal') return ['', ' ', '-0', '+001', '010', '1k', '0x10', '1\n', -4294967295, -1, 0, 1, 2147483648, 4294967296, 4294967297, '2147483648', '-2147483649', '4294967296', '4294967297', '-4294967295', '9223372036854775807', '9223372036854775808', '-9223372036854775809', 9223372036854775808n, true];
  if (typeof parser === 'object' && parser.kind === 'integer') {
    const limit = 1n << BigInt(parser.bits - (parser.signed ? 1 : 0));
    const boundaries = [-limit - 1n, -limit, -1n, 0n, 1n, limit - 1n, limit];
    return [...boundaries, ...boundaries.map(String), ...boundaries.filter(n => n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER)).map(Number), '', '-0', '08', '0x10', '0b10', '  +010k', '1m', '-2g', '1 ', '1\n', '1.5', Number.MAX_SAFE_INTEGER + 1];
  }
  if (parser === 'object-filter' || parser === 'object-filter-auto') return ['', 'invalid', 'blob:none', 'auto', 'tree:0', 'tree:-1', 'combine:+'];
  if (parser === 'depth-initial') {
    const numbers = [-4294967295, -1, 0, 1, 2147483648, 4294967297];
    return [...numbers, ...numbers.map(String), '', '1suffix', '0x10'];
  }
  return [];
}
