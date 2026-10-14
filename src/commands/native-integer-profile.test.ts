import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { parseLegacyGitInteger } from '../constraints/git-integer.js';

const integerError = /not in range|expects .*integer|expects .*numerical/;
const cases = [
  ['--width', '2147483648'],
  ['--width', '4294967297'],
  ['--width', '-4294967295'],
  ['--width', '08'],
  ['--width', '1k'],
  ['--width', '0x10'],
  ['--width', '0b10'],
  ['--width', '1 '],
  ['--width', '1\n'],
  ['--width', ''],
  ['--width', 'bad'],
  ['--raw-mode', '4294967296'],
  ['--raw-mode', '-0'],
  ['--raw-mode', '-1'],
] as const;
describe('selected native integer parser family', () => {
  it.each(cases)('matches selected Git acceptance of %s=%s', async (flag, value) => {
    const native = spawnSync('git', ['column', `${flag}=${value}`, '-h'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect([0, 129], native.stderr).toContain(native.status);
    const git = new TypeGit();
    const result = git.command('column', [[flag, value], ['-h']]);
    if (integerError.test(native.stderr)) {
      await expect(result).rejects.toBeInstanceOf(GitArgumentError);
    } else {
      await expect(result).resolves.toMatchObject({ exitCode: native.status });
    }
  });
  it('preserves native wrapped compression in an actual local pack workflow', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-integer-profile-'));
    try {
      const env = {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'config'),
      };
      expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
      const native = spawnSync(
        'git',
        ['-C', root, 'pack-objects', '--stdout', '--compression=4294967297'],
        { env, input: '', timeout: 10000 },
      );
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      const git = new TypeGit({ inheritEnv: false, env });
      const repo = await git.open(root);
      const result = repo.command('pack-objects', [['--stdout'], ['--compression', '4294967297']], {
        stdin: '',
        stdout: 'bytes',
      });
      if (integerError.test(native.stderr.toString())) {
        expect(native.status).toBe(129);
        await expect(result).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect(native.status, native.stderr.toString()).toBe(0);
        expect(native.stdout.subarray(0, 4).toString()).toBe('PACK');
        await expect(result).resolves.toMatchObject({
          exitCode: 0,
          stdout: new Uint8Array(native.stdout),
        });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('keeps legacy decimal parsing separate from selected C long width and signed storage', () => {
    const signed = { kind: 'integer', signed: true, bits: 32 } as const;
    const unsigned = { ...signed, signed: false } as const;
    expect(parseLegacyGitInteger('2147483648', signed, 64)).toBe(-2147483648n);
    expect(parseLegacyGitInteger('2147483648', signed, 32)).toBe(2147483647n);
    expect(parseLegacyGitInteger('-4294967295', signed, 64)).toBe(1n);
    expect(parseLegacyGitInteger('-4294967295', signed, 32)).toBe(-2147483648n);
    expect(parseLegacyGitInteger('-1', unsigned, 64)).toBe(4294967295n);
    expect(parseLegacyGitInteger('08', signed, 64)).toBe(8n);
    expect(parseLegacyGitInteger('1k', signed, 64)).toBeUndefined();
    expect(parseLegacyGitInteger('1\n', signed, 64)).toBeUndefined();
  });
});
