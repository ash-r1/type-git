import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';

// Older parse-options uses decimal strtol followed by int assignment. A modern
// compiler-recorded precision bound must not reject input accepted by that Git.
describe('selected native integer parser family', () => {
  it.each([
    '2147483648',
    '4294967297',
  ])('preserves selected Git acceptance of wrapped column width %s', async (value, context) => {
    const native = spawnSync('git', ['column', `--width=${value}`, '-h'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect([0, 129], native.stderr).toContain(native.status);
    if (/not in range|expects .*integer|expects .*numerical/.test(native.stderr)) {
      context.skip();
      return;
    }
    expect(native.stdout + native.stderr).toContain('usage:');
    const git = new TypeGit();
    await expect(git.command('column', [['--width', value], ['-h']])).resolves.toMatchObject({
      exitCode: native.status,
    });
  });
});
