/** Git LFS v3.8.0 tools/humanize.ParseBytes; invalid strings remain Git's responsibility. */
export function lfsBytes(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const match = /^([0-9.,]*)(.*)$/s.exec(String(value));
  if (!match) {
    return undefined;
  }
  const digits = match[1]!.replaceAll(',', '');
  if (digits !== '' && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(digits)) {
    return undefined;
  }
  const unit = match[2]!.trim().toLowerCase();
  const multiplier: Record<string, number> = {
    '': 1,
    b: 1,
    kb: 1000,
    mb: 1000 ** 2,
    gb: 1000 ** 3,
    tb: 1000 ** 4,
    pb: 1000 ** 5,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
    pib: 1024 ** 5,
  };
  if (!(unit in multiplier)) {
    return undefined;
  }
  const bytes = Number(digits) * multiplier[unit]!;
  return Number.isFinite(bytes) && bytes < 2 ** 64 ? Math.trunc(bytes) : undefined;
}
