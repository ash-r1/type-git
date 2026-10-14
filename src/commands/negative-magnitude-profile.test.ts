import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';

describe('native unsigned magnitude sign profiles', () => {
  it.each([
    '-0',
    '-1',
    '-1k',
    '-18446744073709551615k',
    '-18446744073709551616',
    ' -0x0g',
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
  it('matches native negative-zero filtering through a real file clone and convenience API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-negative-filter-'));
    try {
      const source = join(root, 'source');
      const env = {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'config'),
        GIT_ALLOW_PROTOCOL: 'file',
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      };
      expect(spawnSync('git', ['init', source], { env }).status).toBe(0);
      await writeFile(join(source, 'file'), 'fixture content\n');
      expect(spawnSync('git', ['-C', source, 'add', 'file'], { env }).status).toBe(0);
      expect(spawnSync('git', ['-C', source, 'commit', '-m', 'fixture'], { env }).status).toBe(0);
      expect(
        spawnSync('git', ['-C', source, 'config', 'uploadpack.allowFilter', 'true'], { env })
          .status,
      ).toBe(0);
      const url = pathToFileURL(source).href;
      const nativePath = join(root, 'native');
      const libraryPath = join(root, 'library');
      const native = spawnSync(
        'git',
        ['clone', '--no-checkout', '--filter=blob:limit=-0', url, nativePath],
        { env, encoding: 'utf8', timeout: 10000 },
      );
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      const git = new TypeGit({ inheritEnv: false, env });
      const result = git.clone(url, libraryPath, { noCheckout: true, filter: 'blob:limit=-0' });
      if (native.stderr.includes('invalid filter-spec')) {
        expect(native.status).toBe(128);
        await expect(result).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect(native.status, native.stderr).toBe(0);
        await expect(result).resolves.toMatchObject({ workdir: libraryPath });
        for (const args of [
          ['rev-parse', 'HEAD'],
          ['config', '--get', 'remote.origin.partialclonefilter'],
        ]) {
          const expected = spawnSync('git', ['-C', nativePath, ...args], { env, encoding: 'utf8' });
          const actual = spawnSync('git', ['-C', libraryPath, ...args], { env, encoding: 'utf8' });
          expect(expected.error).toBeUndefined();
          expect(actual.error).toBeUndefined();
          expect(expected.status).toBe(0);
          expect(actual.status).toBe(0);
          expect(actual.stdout).toBe(expected.stdout);
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
