import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('source-specific filename parser states', () => {
  const negated = [['--list'], ['--file', 'message'], ['--no-file']];
  const empty = [['--list'], ['--file', '']];
  it('clears an earlier filename in the older negation profiles', () => {
    for (const profile of ['legacy', 'intermediate'] as const) {
      expect(
        commandArguments('tag', negated, true, undefined, undefined, undefined, profile),
      ).toEqual(['tag', '--list', '--file=message', '--no-file']);
    }
  });
  it('retains an earlier filename in the optional-stat negation profile', () => {
    expect(() =>
      commandArguments('tag', negated, true, undefined, undefined, undefined, 'optional'),
    ).toThrow(GitArgumentError);
  });
  it('retains a nonnull empty filename in the oldest profile', () => {
    expect(() =>
      commandArguments('tag', empty, true, undefined, undefined, undefined, 'legacy'),
    ).toThrow(GitArgumentError);
  });
  it('clears an empty filename in the newer profiles', () => {
    for (const profile of ['intermediate', 'optional'] as const) {
      expect(
        commandArguments('tag', empty, true, undefined, undefined, undefined, profile),
      ).toEqual(['tag', '--list', '--file=']);
    }
  });
});

const versionResult = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 10000 });
expect(versionResult.error).toBeUndefined();
expect(versionResult.signal).toBeNull();
expect(versionResult.status).toBe(0);
const modern = /^git version 2\.(55|56)\./.test(versionResult.stdout);
const older = /^git version 2\.(25|47)\./.test(versionResult.stdout);
if (!modern && !older) {
  console.warn('Filename profile comparisons are unverified for this Git version.');
}

describe.skipIf(!modern && !older)('native filename state through the public API', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-filename-profile-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    };
    repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'message'), 'fixture message\n');
  });
  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });
  function native(words: string[], expected: number) {
    const result = spawnSync('git', ['tag', ...words], {
      cwd: repo.workdir,
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status, result.stderr).toBe(expected);
    return result;
  }
  it.skipIf(!modern)(
    'allows listing when a missing optional filename leaves the pointer unset',
    async () => {
      native(['--list', '--file=:(optional)missing'], 0);
      await expect(
        repo.command('tag', [['--list'], ['--file', ':(optional)missing']]),
      ).resolves.toMatchObject({ exitCode: 0 });
    },
  );
  it.skipIf(!older)('honors the older clearing negation after a supplied filename', async () => {
    native(['--list', '--file=message', '--no-file'], 0);
    await expect(
      repo.command('tag', [['--list'], ['--file', 'message'], ['--no-file']]),
    ).resolves.toMatchObject({ exitCode: 0 });
  });
  it('combines an empty ordering filename with native wrapping options', async () => {
    const result = spawnSync('git', ['shortlog', '-O', '', '-w80,6,9'], {
      cwd: repo.workdir,
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status, result.stderr).toBe(0);
    await expect(
      repo.command(
        'shortlog',
        [
          ['-O', ''],
          ['-w', '80,6,9'],
        ],
        { stdin: '' },
      ),
    ).resolves.toMatchObject({ exitCode: 0 });
  });
  it('rejects listing with an ordinary retained filename', async () => {
    native(['--list', '--file=message'], 129);
    await expect(repo.command('tag', [['--list'], ['--file', 'message']])).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
  it.skipIf(!modern)(
    'does not turn an optional missing update into a clear of the prior filename',
    async () => {
      native(['--list', '--file=message', '--file=:(optional)missing'], 129);
      await expect(
        repo.command('tag', [['--list'], ['--file', 'message'], ['--file', ':(optional)missing']]),
      ).rejects.toBeInstanceOf(GitArgumentError);
    },
  );
  it.skipIf(!modern)(
    'resolves mixed missing and present optional files before a real commit',
    async () => {
      await writeFile(join(repo.workdir, 'tracked'), 'before\n');
      expect(spawnSync('git', ['add', 'tracked'], { cwd: repo.workdir, env }).status).toBe(0);
      expect(spawnSync('git', ['commit', '-m', 'fixture'], { cwd: repo.workdir, env }).status).toBe(
        0,
      );
      await writeFile(join(repo.workdir, 'tracked'), 'after\n');
      await writeFile(join(repo.workdir, 'paths'), 'tracked\0');
      const result = await repo.command('commit', [
        ['-m', 'mixed states'],
        ['--file', ':(optional)absent'],
        ['--pathspec-from-file', ':(optional)paths'],
        ['--pathspec-file-nul'],
      ]);
      expect(result.exitCode).toBe(0);
      const subject = spawnSync('git', ['log', '-1', '--format=%s'], {
        cwd: repo.workdir,
        env,
        encoding: 'utf8',
      });
      const content = spawnSync('git', ['show', 'HEAD:tracked'], {
        cwd: repo.workdir,
        env,
        encoding: 'utf8',
      });
      expect(subject.error).toBeUndefined();
      expect(content.error).toBeUndefined();
      expect(subject.status).toBe(0);
      expect(content.status).toBe(0);
      expect(subject.stdout.trim()).toBe('mixed states');
      expect(content.stdout).toBe('after\n');
    },
  );
  it.skipIf(!modern)(
    'defers ENOTDIR optional stat failure to the requested native command',
    async () => {
      const words = ['--list', '--file=:(optional)message/child'];
      const expected = native(words, process.platform === 'win32' ? 0 : 128);
      const result = await repo.command('tag', [
        ['--list'],
        ['--file', ':(optional)message/child'],
      ]);
      expect(result.exitCode).toBe(expected.status);
      expect(result.stderr).toBe(expected.stderr);
    },
  );
  it.skipIf(!modern)(
    'preserves optional stat failure before a final message conflict',
    async () => {
      const words = [
        'commit',
        '--dry-run',
        '-m',
        'inline',
        '-F',
        'message',
        '-F',
        ':(optional)message/child',
      ];
      const expected = spawnSync('git', words, {
        cwd: repo.workdir,
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(expected.error).toBeUndefined();
      expect(expected.status).toBe(128);
      if (process.platform === 'win32') {
        expect(expected.stderr).toContain("options '-m' and '-F' cannot be used together");
        await expect(
          repo.command('commit', [
            ['--dry-run'],
            ['-m', 'inline'],
            ['-F', 'message'],
            ['-F', ':(optional)message/child'],
          ] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
        return;
      }
      expect(expected.stderr).toContain('could not stat message/child');
      const result = await repo.command('commit', [
        ['--dry-run'],
        ['-m', 'inline'],
        ['-F', 'message'],
        ['-F', ':(optional)message/child'],
      ] as never);
      expect(result.exitCode).toBe(128);
      expect(result.stderr).toBe(expected.stderr);
    },
  );
  it.skipIf(!modern)('preserves optional stat failure before a later color callback', async () => {
    const expected = native(
      ['--list', '--file=:(optional)message/child', '--color=invalid'],
      process.platform === 'win32' ? 129 : 128,
    );
    if (process.platform === 'win32') {
      expect(expected.stderr).toContain('color');
      await expect(
        repo.command('tag', [
          ['--list'],
          ['--file', ':(optional)message/child'],
          ['--color', 'invalid'],
        ] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      return;
    }
    expect(expected.stderr).toContain('could not stat message/child');
    const result = await repo.command('tag', [
      ['--list'],
      ['--file', ':(optional)message/child'],
      ['--color', 'invalid'],
    ] as never);
    expect(result.exitCode).toBe(128);
    expect(result.stderr).toBe(expected.stderr);
    const earlier = native(['--list', '--color=invalid', '--file=:(optional)message/child'], 129);
    expect(earlier.status).toBe(129);
    await expect(
      repo.command('tag', [
        ['--list'],
        ['--color', 'invalid'],
        ['--file', ':(optional)message/child'],
      ] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});
