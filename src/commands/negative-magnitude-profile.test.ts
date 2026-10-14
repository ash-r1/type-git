import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';

describe('native unsigned magnitude sign profiles', () => {
  it.each([
    '-0',
    '-1',
  ])('preserves selected Git magnitude acceptance of %s before help', async (value) => {
    const native = spawnSync('git', ['pack-objects', `--max-pack-size=${value}`, '-h'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect(native.status).toBe(129);
    const result = new TypeGit().command('pack-objects', [['--max-pack-size', value], ['-h']]);
    if (/expects .*integer|not in range/.test(native.stderr)) {
      await expect(result).rejects.toBeInstanceOf(GitArgumentError);
    } else {
      expect(native.stdout + native.stderr).toContain('usage:');
      await expect(result).resolves.toMatchObject({ exitCode: native.status });
    }
  });
  it('preserves the unsigned magnitude parser used by object filters', async () => {
    const filter = 'blob:limit=-0';
    const native = spawnSync('git', ['clone', `--filter=${filter}`, '-h'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    const result = new TypeGit().command('clone', [['--filter', filter], ['-h']]);
    if (native.stderr.includes('invalid filter-spec')) {
      expect(native.status).toBe(128);
      await expect(result).rejects.toBeInstanceOf(GitArgumentError);
    } else {
      expect(native.status).toBe(129);
      expect(native.stdout + native.stderr).toContain('usage:');
      await expect(result).resolves.toMatchObject({ exitCode: native.status });
    }
  });
});
