/** Readonly parse-only argv: an intentional unknown option stops before path access. */
export const PICKAXE_EMPTY_PROBE = [
  'diff',
  '--no-index',
  '-S',
  '',
  '--type-git-pickaxe-probe',
] as const;

/** Recognize only the source-audited callback diagnostics; unknown output stays native. */
export function pickaxeEmptyRejected(result: {
  exitCode: number;
  stdout: string;
  stderr: string;
  aborted: boolean;
}): boolean | undefined {
  if (result.aborted || result.exitCode !== 129 || result.stdout !== '') {
    return undefined;
  }
  if (/^error: -S requires a non-empty argument\r?\n$/.test(result.stderr)) {
    return true;
  }
  if (
    /^error: unknown option `type-git-pickaxe-probe'\r?\nusage: git diff --no-index /.test(
      result.stderr,
    ) &&
    !/^(?:fatal:|error: (?!unknown option `type-git-pickaxe-probe'))/m.test(result.stderr)
  ) {
    return false;
  }
  return undefined;
}
