/** Native C long width for Node-compatible host architecture identifiers. */
export function nativeCLongBits(platform: string, architecture: string): 32 | 64 {
  return platform === 'win32' ||
    ['ia32', 'arm', 'mips', 'mipsel', 'ppc', 's390'].includes(architecture)
    ? 32
    : 64;
}

/** size_t follows pointer width, including 64-bit Windows LLP64 hosts. */
export function nativeSizeTBits(architecture: string): 32 | 64 {
  return ['ia32', 'arm', 'mips', 'mipsel', 'ppc', 's390'].includes(architecture) ? 32 : 64;
}
