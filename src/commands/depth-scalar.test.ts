import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('final scalar constraints', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-depth-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
    };
    expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // No remotes: fetch --all evaluates the initial depth constraint without a
  // transport parser obscuring that phase or making any network connection.
  it('matches the native atoi boundaries and ignored suffixes', () => {
    const values = [
      '',
      '0',
      '1',
      '-1',
      '+2',
      ' 3',
      '0x10',
      '0b10',
      '08',
      '1suffix',
      '2147483647',
      '2147483648',
      '4294967295',
      '4294967296',
      '4294967297',
      '-2147483649',
      '-4294967295',
      '8589934593',
      '9223372036854775807',
      '9223372036854775808',
      '-9223372036854775809',
      'foo',
      '+',
      '1.5',
      '1 ',
      ...Array.from({ length: 17 }, (_, index) => String(4294967296 + index - 8)),
    ];
    for (const value of values) {
      const native = spawnSync('git', ['-C', root, 'fetch', '--all', `--depth=${value}`], {
        env,
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(native.error).toBeUndefined();
      const build = () => commandArguments('fetch', [['--all'], ['--depth', value]], true);
      if (native.status === 0) {
        expect(build, value).not.toThrow();
      } else {
        expect(native.stderr, value).toContain('is not a positive number');
        expect(build, value).toThrow(GitArgumentError);
      }
    }
  });

  it('checks only the final depth and permits help before final validation', () => {
    for (const flags of [
      [
        ['--depth', 'bad'],
        ['--depth', '1'],
      ],
      [['--depth', '0'], ['--no-depth']],
      [['--depth', 'bad'], ['-h']],
    ]) {
      const built = commandArguments('fetch', [['--all'], ...flags], true);
      const native = spawnSync('git', ['-C', root, ...built], {
        env,
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(native.error).toBeUndefined();
      expect([0, 129], native.stderr).toContain(native.status);
    }
  });

  it.skipIf(legacy)(
    'rejects invalid filters in convenience methods before spawning Git',
    async () => {
      const git = new TypeGit({ home: root, inheritEnv: false, env });
      const repo = await git.open(root);
      for (const filter of ['', 'invalid', 'tree:-1', 'combine:auto']) {
        await expect(git.clone(root, join(root, 'unused'), { filter })).rejects.toBeInstanceOf(
          GitArgumentError,
        );
        await expect(repo.submodule.update({ init: true, filter })).rejects.toBeInstanceOf(
          GitArgumentError,
        );
      }
      await repo.submodule.update({ init: true, filter: 'blob:none' });
    },
  );

  it('accepts depth values that Git converts to positive signed integers in convenience clone', async () => {
    const git = new TypeGit({ home: root, inheritEnv: false, env });
    for (const depth of [4294967297, -4294967295]) {
      const destination = join(root, `clone-${depth}`);
      const native = spawnSync(
        'git',
        ['clone', `--depth=${depth}`, root, `${destination}-native`],
        { env, encoding: 'utf8', timeout: 5000 },
      );
      expect(native.status, native.stderr).toBe(0);
      await git.clone(root, destination, { depth });
    }
    await expect(
      git.clone(root, join(root, 'bad-depth'), { depth: 2147483648 }),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});
