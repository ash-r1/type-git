import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('final scalar constraints', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  let transportLongBits: 32 | 64;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-depth-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_ALLOW_PROTOCOL: 'file',
    };
    expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
    const widths = spawnSync('git', ['version', '--build-options'], { env, encoding: 'utf8' });
    expect(widths.error).toBeUndefined();
    expect(widths.signal).toBeNull();
    expect(widths.status).toBe(0);
    const longBytes = /^sizeof-long: ([48])\r?$/m.exec(widths.stdout)?.[1];
    expect(longBytes).toBeDefined();
    transportLongBits = longBytes === '4' ? 32 : 64;
    for (let index = 0; index < 3; index++) {
      const commit = spawnSync(
        'git',
        ['-C', root, 'commit', '--allow-empty', '-m', `fixture ${index}`],
        { env },
      );
      expect(commit.error).toBeUndefined();
      expect(commit.signal).toBeNull();
      expect(commit.status).toBe(0);
    }
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

  it.each([
    1, 4294967297, -4294967295,
  ])('matches the selected Git transport depth for %s via file://', async (depth) => {
    const git = new TypeGit({ home: root, inheritEnv: false, env });
    const destination = join(root, `clone-${depth}`);
    const source = pathToFileURL(root).href;
    const native = spawnSync(
      'git',
      ['clone', `--depth=${depth}`, source, `${destination}-native`],
      { env, encoding: 'utf8', timeout: 5000 },
    );
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect(native.status, native.stderr).toBe(0);
    expect(native.stderr).not.toContain('--depth is ignored');
    await git.clone(source, destination, { depth });
    // transport.c uses strtol (not atoi), then stores the value in an int.
    // LLP64 can therefore fetch a different history after the initial check.
    const minimum = -(1n << BigInt(transportLongBits - 1));
    const maximum = (1n << BigInt(transportLongBits - 1)) - 1n;
    const number = BigInt(depth);
    const clamped = number < minimum ? minimum : number > maximum ? maximum : number;
    const converted = Number(BigInt.asIntN(32, clamped));
    const expectedCount = converted > 0 ? String(Math.min(3, converted)) : '3';
    const expectedShallow = converted > 0 && converted < 3 ? 'true' : 'false';
    for (const path of [`${destination}-native`, destination]) {
      for (const [words, expected] of [
        [['rev-list', '--count', 'HEAD'], expectedCount],
        [['rev-parse', '--is-shallow-repository'], expectedShallow],
      ] as const) {
        const result = spawnSync('git', ['-C', path, ...words], {
          env,
          encoding: 'utf8',
          timeout: 5000,
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout.trim()).toBe(expected);
      }
    }
  });
  it('rejects an invalid converted depth before cloning', async () => {
    const git = new TypeGit({ home: root, inheritEnv: false, env });
    await expect(
      git.clone(root, join(root, 'bad-depth'), { depth: 2147483648 }),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});
