import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

describe('grep internal help and filename suppression', () => {
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
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (args: readonly unknown[], words: string[]) => {
    const expected = native(['grep', ...words]);
    const actual = await repo.command('grep', args as never);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('a lone short h exits before the registered filename option', async () => {
    const result = await compare([['-h']], ['-h']);
    expect([0, 129]).toContain(result.status);
    expect(result.stdout + result.stderr).toContain('usage:');
  }, 120_000);
  it('full internal help exits in first position and before later callbacks', async () => {
    for (const args of [
      [['--help-all']],
      [['--threads', 1], ['--help-all'], ['--threads', 'invalid']],
      [['--threads', -1], ['--help-all']],
      [['-h'], ['--help-all'], ['--threads', 'invalid']],
    ]) {
      const words = args.map((a) => (a.length === 1 ? String(a[0]) : `${a[0]}=${a[1]}`));
      const result = await compare(args, words);
      expect([0, 129]).toContain(result.status);
      expect(result.stdout + result.stderr).toContain('usage:');
    }
  }, 120_000);
  it('full help does not preempt earlier integer errors or pattern/operand interpretation', async () => {
    const invalid = native(['grep', '--threads=invalid', '--help-all']);
    expect(invalid.status).toBe(129);
    expect(invalid.stderr).toMatch(/expects (?:a numerical|an integer) value/);
    await expect(
      repo.command('grep', [['--threads', 'invalid'], ['--help-all']] as never),
    ).rejects.toMatchObject({
      name: 'GitArgumentError',
      message: '--threads: invalid integer value invalid',
    });
    const value = await compare(
      [['--threads', 1], ['-e', '--help-all'], ['--'], { operand: 'file' }],
      ['--threads=1', '-e', '--help-all', '--', 'file'],
    );
    expect(value.status).toBe(1);
    expect(value.stdout + value.stderr).not.toContain('usage:');
    const operand = await compare(
      [['--threads', 1], { operand: 'base' }, { operand: '--help-all' }],
      ['--threads=1', 'base', '--help-all'],
    );
    expect(operand.status).toBe(128);
  }, 120_000);
  it('preserves native one-word completion output and older unsupported helpers', async () => {
    for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
      const result = await compare([[flag]], [flag]);
      if (result.status === 0) {
        expect(result.stdout).toContain('--cached');
      } else {
        expect(flag).toBe('--git-completion-helper-all');
        expect(result.status).toBe(129);
        expect(result.stderr).toContain('unknown option');
      }
    }
  }, 120_000);
  it('rejects reached multiword completion helpers before later help', async () => {
    for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
      for (const args of [
        [[flag], ['--help-all']],
        [['--threads', 1], [flag]],
      ]) {
        const words = args.map((a) => (a.length === 1 ? String(a[0]) : `${a[0]}=${a[1]}`));
        const expected = native(['grep', ...words]);
        expect(expected.status).toBe(129);
        expect(expected.stderr).toContain('unknown option');
        await expect(repo.command('grep', args as never)).rejects.toThrow('one-word]');
      }
    }
  }, 120_000);
  it('earlier help preempts completion checks and values remain patterns', async () => {
    for (const flag of ['--git-completion-helper', '--git-completion-helper-all']) {
      const result = await compare(
        [['--help-all'], [flag], ['--threads', 'invalid']],
        ['--help-all', flag, '--threads=invalid'],
      );
      expect([0, 129]).toContain(result.status);
      expect(result.stdout + result.stderr).toContain('usage:');
      const value = await compare(
        [['--threads', 1], ['-e', flag], ['--'], { operand: 'file' }],
        ['--threads=1', '-e', flag, '--', 'file'],
      );
      expect(value.status).toBe(1);
      expect(value.stdout).toBe('');
    }
  }, 120_000);
  it('internal long help preempts later integer callbacks', async () => {
    for (const value of ['invalid', '2147483648', '4294967295']) {
      const result = await compare(
        [['--threads', 1], ['--help'], ['--threads', value]],
        ['--threads=1', '--help', `--threads=${value}`],
      );
      expect([0, 129]).toContain(result.status);
      expect(result.stdout + result.stderr).toContain('usage:');
    }
  }, 120_000);
  it('long help preempts final mode conditions', async () => {
    for (const args of [
      [['--threads', -1], ['--help']],
      [['--cached'], ['--no-index'], ['--help']],
    ]) {
      const words = args.map((a) => (a.length === 1 ? String(a[0]) : `${a[0]}=${a[1]}`));
      const result = await compare(args, words);
      expect([0, 129]).toContain(result.status);
      expect(result.stdout + result.stderr).toContain('usage:');
    }
  }, 120_000);
  it('keeps earlier integer failures before long help', async () => {
    const expected = native(['grep', '--threads=invalid', '--help']);
    expect(expected.status).toBe(129);
    expect(expected.stderr).toMatch(/expects (?:a numerical|an integer) value/);
    const result = repo.command('grep', [['--threads', 'invalid'], ['--help']] as never);
    await expect(result).rejects.toBeInstanceOf(GitArgumentError);
    await expect(result).rejects.toMatchObject({
      message: '--threads: invalid integer value invalid',
    });
  }, 120_000);
  it('short h still suppresses filenames for a successful search', async () => {
    const result = await compare(
      [['-h'], ['--threads', 1], ['-e', 'base'], ['--'], { operand: 'file' }],
      ['-h', '--threads=1', '-e', 'base', '--', 'file'],
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('base\n');
  }, 120_000);
  it('short h does not preempt later callbacks or missing patterns', async () => {
    const expected = native(['grep', '-h', '--threads=invalid', '-e', 'base']);
    expect(expected.status).toBe(129);
    expect(expected.stderr).toMatch(/expects (?:a numerical|an integer) value/);
    await expect(
      repo.command('grep', [['-h'], ['--threads', 'invalid'], ['-e', 'base']] as never),
    ).rejects.toMatchObject({
      name: 'GitArgumentError',
      message: '--threads: invalid integer value invalid',
    });
    expect(native(['grep', '-h', '--threads=1']).status).toBe(128);
    await expect(repo.command('grep', [['-h'], ['--threads', 1]] as never)).rejects.toThrow(
      '[cli.grep.pattern]',
    );
  }, 120_000);
  it('retains native failure for help-looking words after the first operand', async () => {
    expect(
      (
        await compare(
          [['--threads', 1], { operand: 'base' }, { operand: '--help' }],
          ['--threads=1', 'base', '--help'],
        )
      ).status,
    ).toBe(128);
  }, 120_000);
  it('accepts a help-looking filename after an explicit separator', async () => {
    expect(
      (
        await compare(
          [['--threads', 1], ['-e', 'base'], ['--'], { operand: '--help' }],
          ['--threads=1', '-e', 'base', '--', '--help'],
        )
      ).status,
    ).toBe(0);
  }, 120_000);
});
