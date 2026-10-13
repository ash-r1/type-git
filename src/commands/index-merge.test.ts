import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('index, ref update and low-level merge grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-index-merge-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
    input = '',
  ) => {
    const actual = direct([...command.split(' '), ...argv], input);
    const label = `${command} ${argv.join(' ')}: ${actual.stderr}`;
    expect(actual.signal, label).toBe(null);
    expect(actual.error, label).toBeUndefined();
    expect(actual.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([...command.split(' '), ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };

  it('matches update-ref transaction modes and final message validation', async () => {
    compare(
      'update-ref',
      [{ operand: 'refs/heads/test' }, { operand: 'HEAD' }],
      ['refs/heads/test', 'HEAD'],
      true,
    );
    compare(
      'update-ref',
      [['-d'], { operand: 'refs/heads/test' }],
      ['-d', 'refs/heads/test'],
      true,
    );
    compare('update-ref', [['--stdin'], ['-z']], ['--stdin', '-z'], true);
    compare('update-ref', [['--stdin'], ['-d']], ['--stdin', '-d'], false);
    compare('update-ref', [['--stdin'], ['-m', '']], ['--stdin', '-m', ''], false);
    compare(
      'update-ref',
      [['--stdin'], ['-m', ''], ['-m', 'valid']],
      ['--stdin', '-m', '', '-m', 'valid'],
      true,
    );
    compare(
      'update-ref',
      [['-z'], { operand: 'refs/heads/test' }, { operand: 'HEAD' }],
      ['-z', 'refs/heads/test', 'HEAD'],
      false,
    );
    compare('update-ref', [{ operand: 'refs/heads/test' }], ['refs/heads/test'], false);
    if (!legacy) {
      compare(
        'update-ref',
        [['--stdin'], ['--batch-updates']],
        ['--stdin', '--batch-updates'],
        true,
      );
      compare(
        'update-ref',
        [['--batch-updates'], { operand: 'refs/heads/test' }, { operand: 'HEAD' }],
        ['--batch-updates', 'refs/heads/test', 'HEAD'],
        false,
      );
    }
    const result = await repo.command('update-ref', [['--stdin']], {
      stdin: `verify HEAD ${direct(['rev-parse', 'HEAD']).stdout.trim()}\n`,
    });
    expect(result.exitCode).toBe(0);
  });

  it('matches checkout-index stage callback and input-source combinations', () => {
    for (const stage of ['1', '2', '3', '1suffix', 'all']) {
      compare('checkout-index', [['--stage', stage]], [`--stage=${stage}`], true);
    }
    compare(
      'checkout-index',
      [
        ['--stage', '4'],
        ['--stage', 'all'],
      ],
      ['--stage=4', '--stage=all'],
      false,
    );
    if (!legacy) {
      compare(
        'checkout-index',
        [['--stage', 'all'], ['--no-temp']],
        ['--stage=all', '--no-temp'],
        false,
      );
    }
    compare('checkout-index', [['--all'], ['--stdin']], ['--all', '--stdin'], false);
    for (const flag of ['--all', '--stdin']) {
      compare('checkout-index', [[flag], { operand: 'tracked' }], [flag, 'tracked'], false);
    }
    const prefix = `${root}/checkout/`;
    compare(
      'checkout-index',
      [['--all'], ['--prefix', prefix], ['--index']],
      ['--all', `--prefix=${prefix}`, '--index'],
      true,
    );
    compare('checkout-index', [['-z']], ['-z'], true);
  });

  it('matches read-tree modes, callback ordering and the native eight-tree limit', () => {
    compare('read-tree', [['--dry-run'], ['--empty']], ['--dry-run', '--empty'], true);
    compare(
      'read-tree',
      [['--dry-run'], ['--trivial'], { operand: 'HEAD' }],
      ['--dry-run', '--trivial', 'HEAD'],
      true,
    );
    compare(
      'read-tree',
      [
        ['--dry-run'],
        ['-m'],
        ['-u'],
        ['--exclude-per-directory', '.gitignore'],
        { operand: 'HEAD' },
      ],
      ['--dry-run', '-m', '-u', '--exclude-per-directory=.gitignore', 'HEAD'],
      true,
    );
    if (!legacy) {
      compare(
        'read-tree',
        [['--exclude-per-directory', '.gitignore'], ['-u'], ['-m'], { operand: 'HEAD' }],
        ['--exclude-per-directory=.gitignore', '-u', '-m', 'HEAD'],
        false,
      );
    }
    for (const opts of [
      ['-m', '--reset'],
      ['-m', '--prefix='],
      ['-u'],
      ['-m', '-u', '-i'],
      ['--empty'],
      ['--prefix=/absolute'],
    ]) {
      const tokens = opts.map((flag) =>
        flag.includes('=') ? [flag.split('=')[0], flag.slice(flag.indexOf('=') + 1)] : [flag],
      );
      compare(
        'read-tree',
        [['--dry-run'], ...tokens, { operand: 'HEAD' }],
        ['--dry-run', ...opts, 'HEAD'],
        false,
      );
    }
    compare('read-tree', [['--dry-run'], ['-m']], ['--dry-run', '-m'], false);
    for (const count of [8, 9]) {
      compare(
        'read-tree',
        [['--dry-run'], ['-m'], ...Array.from({ length: count }, () => ({ operand: 'HEAD' }))],
        ['--dry-run', '-m', ...Array<string>(count).fill('HEAD')],
        count === 8,
      );
    }
  });

  it('matches merge-file labels, case-insensitive algorithms and last-wins choices', async () => {
    const files = ['ours', 'base', 'theirs'].map((name) => join(root, name));
    for (const file of files) {
      await writeFile(file, 'same\n');
    }
    const operands = files.map((operand) => ({ operand }));
    const modern = legacy ? [] : ['--zdiff3'];
    compare(
      'merge-file',
      [
        ['--stdout'],
        ['--ours'],
        ['--theirs'],
        ['--diff3'],
        ...modern.map((flag) => [flag]),
        ...operands,
      ],
      ['--stdout', '--ours', '--theirs', '--diff3', ...modern, ...files],
      true,
    );
    for (const count of [3, 4]) {
      const labels = Array.from({ length: count }, (_, i) => ['-L', String(i)]);
      compare(
        'merge-file',
        [['--stdout'], ...labels, ...operands],
        ['--stdout', ...labels.flat(), ...files],
        count === 3,
      );
    }
    if (!legacy) {
      compare(
        'merge-file',
        [['--stdout'], ['--diff-algorithm', 'DeFaUlT'], ...operands],
        ['--stdout', '--diff-algorithm=DeFaUlT', ...files],
        true,
      );
      compare(
        'merge-file',
        [['--diff-algorithm', 'unknown'], ['--diff-algorithm', 'myers'], ...operands],
        ['--diff-algorithm=unknown', '--diff-algorithm=myers', ...files],
        false,
      );
    }
  });

  it.skipIf(legacy)('matches implicit trivial merging and original-token restrictions', () => {
    const two = [{ operand: 'HEAD' }, { operand: 'HEAD' }];
    const three = [...two, { operand: 'HEAD' }];
    compare('merge-tree', two, ['HEAD', 'HEAD'], true);
    compare(
      'merge-tree',
      [['--quiet'], ['--no-messages'], ...two],
      ['--quiet', '--no-messages', 'HEAD', 'HEAD'],
      true,
    );
    compare('merge-tree', three, ['HEAD', 'HEAD', 'HEAD'], true);
    compare(
      'merge-tree',
      [['--trivial-merge'], ...three],
      ['--trivial-merge', 'HEAD', 'HEAD', 'HEAD'],
      true,
    );
    compare('merge-tree', [['--stdin'], { operand: 'ignored' }], ['--stdin', 'ignored'], true);
    for (const opts of [
      ['--messages', '--no-messages'],
      ['--'],
      ['--trivial-merge', '--trivial-merge'],
    ]) {
      compare(
        'merge-tree',
        [...opts.map((flag) => [flag]), ...three],
        [...opts, 'HEAD', 'HEAD', 'HEAD'],
        false,
      );
    }
    compare('merge-tree', [['--quiet'], ['--stdin']], ['--quiet', '--stdin'], false);
    compare(
      'merge-tree',
      [['--stdin'], ['--merge-base', 'HEAD']],
      ['--stdin', '--merge-base=HEAD'],
      false,
    );
    compare(
      'merge-tree',
      [['--write-tree'], ...three],
      ['--write-tree', 'HEAD', 'HEAD', 'HEAD'],
      false,
    );
  });
});
