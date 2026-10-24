import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('internal help in utility parsers', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-utility-help-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (
    command: 'column' | 'fmt-merge-msg' | 'update-ref',
    args: readonly (readonly string[])[],
    words: string[],
  ) => {
    const expected = native([command, ...words]);
    const actual = await repo.command(command, args as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  for (const command of ['column', 'fmt-merge-msg', 'update-ref'] as const) {
    it(`${command}: exposes short and full internal help`, async () => {
      for (const flag of ['-h', '--help-all']) {
        const result = await compare(command, [[flag]], [flag]);
        expect([0, 129]).toContain(result.status);
        expect(result.stdout + result.stderr).toContain('usage:');
      }
    });
    it(`${command}: preserves sole completion output and unsupported legacy errors`, async () => {
      for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
        const result = await compare(command, [[flag]], [flag]);
        if (flag === '--git-completion-helper-all' && result.status !== 0) {
          expect(result.status).toBe(129);
          expect(result.stderr).toContain('unknown option');
        } else {
          expect(result.status).toBe(0);
          expect(result.stdout.length).toBeGreaterThan(0);
        }
      }
    });
    it(`${command}: rejects a reached multiword helper but allows earlier help`, async () => {
      for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
        const expected = native([command, flag, '--help-all']);
        expect(expected.status).toBe(129);
        expect(expected.stderr).toContain('unknown option');
        const actual = repo.command(command, [[flag], ['--help-all']] as never);
        await expect(actual).rejects.toBeInstanceOf(GitArgumentError);
        await expect(actual).rejects.toMatchObject({
          message: expect.stringContaining(`cli.${command}.${flag.slice(6)}-one-word`),
        });
        await compare(command, [['--help-all'], [flag]], ['--help-all', flag]);
      }
    });
  }
  for (const [command, flag] of [
    ['column', '--width'],
    ['fmt-merge-msg', '--log'],
  ] as const) {
    it(`${command}: keeps callback order around internal help`, async () => {
      for (const help of ['-h', '--help', '--help-all']) {
        await compare(
          command,
          [[flag, '1'], [help], [flag, 'invalid']],
          [`${flag}=1`, help, `${flag}=invalid`],
        );
        const expected = native([command, `${flag}=invalid`, help]);
        expect(expected.status).toBe(129);
        expect(expected.stderr).toMatch(/integer|numerical/);
        const actual = repo.command(command, [[flag, 'invalid'], [help]] as never);
        await expect(actual).rejects.toBeInstanceOf(GitArgumentError);
        await expect(actual).rejects.toMatchObject({ message: expect.stringContaining(flag) });
      }
    });
    it(`${command}: the end marker keeps help as an operand`, async () => {
      const expected = native([command, '--', '--help-all']);
      expect(expected.status).toBe(129);
      await expect(repo.command(command, ['--', ['--help-all']] as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
    });
  }
  it('help preempts final padding, file opening and reflog mode checks', async () => {
    await compare('column', [['--padding', '-1'], ['-h']], ['--padding=-1', '-h']);
    await compare(
      'column',
      [['--width', '1'], ['--command', 'status'], ['--help-all']],
      ['--width=1', '--command=status', '--help-all'],
    );
    await compare(
      'fmt-merge-msg',
      [['-F', 'missing-file'], ['--help-all']],
      ['-F', 'missing-file', '--help-all'],
    );
    await compare('update-ref', [['-m', ''], ['--help-all']], ['-m', '', '--help-all']);
    await compare('update-ref', [['--stdin'], ['-d'], ['-h']], ['--stdin', '-d', '-h']);
    await compare(
      'update-ref',
      [['--no-deref'], ['--help'], ['-m', '']],
      ['--no-deref', '--help', '-m', ''],
    );
  });
  it('a help-looking string value is not an internal exit', async () => {
    const result = await compare('column', [['--indent', '-h']], ['--indent=-h']);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('usage:');
  });
});
