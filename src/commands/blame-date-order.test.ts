import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('streaming blame revision date callbacks', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-date-mode-'));
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
    await writeFile(join(root, '--date=invalid'), 'literal date path\n');
    await writeFile(join(root, '-h'), 'literal help path\n');
    expect(native(['add', '--', 'file', '--date=invalid', '-h']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
    const compare = async (args: readonly unknown[], words: string[]) => {
      const expected = native([command, ...words]);
      const actual = await repo.command(command, args as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    };

    it(`${command}: executes reached date callbacks before help and later valid dates`, async () => {
      for (const value of ['', 'invalid', 'ISO', 'format', 'iso-local-local']) {
        for (const tail of [[['-h']], [['--date', 'iso'], ['-h']], [{ operand: 'HEAD' }, ['-h']]]) {
          const args = [['--date', value], ...tail];
          const words = args.map((arg) =>
            Array.isArray(arg)
              ? arg.length === 1
                ? arg[0]!
                : `${arg[0]}=${arg[1]}`
              : (arg as { operand: string }).operand,
          );
          const expected = native([command, ...words]);
          expect(expected.status).toBe(128);
          expect(expected.stderr).toMatch(
            /(?:unknown date format|date format missing colon separator)/,
          );
          await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        }
      }
    }, 120_000);

    it(`${command}: help preempts later date and command-owned callback errors`, async () => {
      for (const help of ['-h', '--help']) {
        const args = [
          ['--date', 'iso'],
          [help],
          ['--date', 'invalid'],
          ['--diff-algorithm', 'invalid'],
        ];
        const expected = await compare(args, [
          '--date=iso',
          help,
          '--date=invalid',
          '--diff-algorithm=invalid',
        ]);
        expect([0, 129]).toContain(expected.status);
        expect(expected.stdout + expected.stderr).toContain('usage:');
      }
      const first = await compare(
        [['-h'], ['--date', 'invalid'], ['--diff-algorithm', 'invalid']],
        ['-h', '--date=invalid', '--diff-algorithm=invalid'],
      );
      expect([0, 129]).toContain(first.status);
      expect(first.stdout + first.stderr).toContain('usage:');
    }, 120_000);

    it(`${command}: still reaches date callbacks after a revision operand`, async () => {
      const expected = native([command, 'HEAD', '--date=invalid', '-h']);
      expect(expected.status).toBe(128);
      expect(expected.stderr).toContain('unknown date format');
      await expect(
        repo.command(command, [{ operand: 'HEAD' }, ['--date', 'invalid'], ['-h']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }, 120_000);

    it(`${command}: retains earlier command-owned callback validation`, async () => {
      const expected = native([command, '--diff-algorithm=invalid', '-h', '--date=invalid']);
      expect(expected.status).toBe(129);
      expect(expected.stderr).toContain('diff-algorithm');
      await expect(
        repo.command(command, [
          ['--diff-algorithm', 'invalid'],
          ['-h'],
          ['--date', 'invalid'],
        ] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
    }, 120_000);

    it(`${command}: treats date/help spellings after -- as literal file paths`, async () => {
      for (const file of ['--date=invalid', '-h']) {
        expect(
          (await compare([{ operand: 'HEAD' }, ['--'], { operand: file }], ['HEAD', '--', file]))
            .status,
        ).toBe(0);
      }
    }, 120_000);

    it(`${command}: accepts supported date modes for successful blame`, async () => {
      for (const value of ['iso', 'raw', 'relative', 'format:%Y', 'auto:invalid']) {
        expect(
          (
            await compare(
              [['--date', value], { operand: 'HEAD' }, ['--'], { operand: 'file' }],
              [`--date=${value}`, 'HEAD', '--', 'file'],
            )
          ).status,
        ).toBe(0);
      }
    }, 120_000);
  }
});
