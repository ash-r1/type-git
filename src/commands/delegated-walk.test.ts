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
describe('delegated revision and diff grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-delegated-walk-'));
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
      GIT_EDITOR: 'true',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await writeFile(join(repo.workdir, 'second'), 'two\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
    await repo.add('.');
    await repo.commit({ message: 'second' });
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

  it('matches range forms, trailing paths and exclusive side selections', () => {
    const args = [{ operand: 'HEAD~' }, { operand: 'HEAD' }, { operand: 'HEAD' }];
    compare('range-diff', args, ['HEAD~', 'HEAD', 'HEAD'], true);
    if (!legacy) {
      // Git 2.25 requires the old fixed-arity revision forms.
      compare(
        'range-diff',
        [...args, { operand: 'tracked' }],
        ['HEAD~', 'HEAD', 'HEAD', 'tracked'],
        true,
      );
    }
    compare(
      'range-diff',
      [['--left-only'], ['--right-only'], ...args],
      ['--left-only', '--right-only', 'HEAD~', 'HEAD', 'HEAD'],
      false,
    );
    compare('range-diff', [{ operand: 'HEAD...HEAD' }], ['HEAD...HEAD'], true);
    compare('range-diff', [], [], false);
    compare('range-diff', [['--'], { operand: 'tracked' }], ['--', 'tracked'], false);
    compare(
      'range-diff',
      [...args, { operand: 'HEAD' }, ['--']],
      ['HEAD~', 'HEAD', 'HEAD', 'HEAD', '--'],
      false,
    );
    if (!legacy) {
      compare(
        'range-diff',
        [['--max-memory', '1m'], ['--no-max-memory'], ...args],
        ['--max-memory=1m', '--no-max-memory', 'HEAD~', 'HEAD', 'HEAD'],
        true,
      );
    }
  });
  it.skipIf(legacy)('matches backfill rejection and sticky callback selections', () => {
    compare('backfill', [], [], true);
    compare(
      'backfill',
      [['--min-batch-size', 1], ['--no-sparse']],
      ['--min-batch-size=1', '--no-sparse'],
      true,
    );
    for (const flag of ['-S', '-G']) {
      compare('backfill', [[flag, 'one']], [flag, 'one'], false);
    }
    for (const flag of ['-m', '-c', '--cc', '--dd', '--remerge-diff', '--no-diff-merges']) {
      compare('backfill', [[flag]], [flag], false);
    }
    compare('backfill', [['--diff-merges', 'off']], ['--diff-merges=off'], false);
    compare('backfill', [['--diff-filter', '']], ['--diff-filter='], true);
    compare(
      'backfill',
      [
        ['--diff-filter', 'A'],
        ['--diff-filter', ''],
      ],
      ['--diff-filter=A', '--diff-filter='],
      false,
    );
    compare('backfill', [['--follow'], { operand: 'tracked' }], ['--follow', 'tracked'], false);
    compare('backfill', [['--follow'], ['--no-follow']], ['--follow', '--no-follow'], true);
  });
  it.skipIf(legacy)('matches last-modified defaults and own short options', () => {
    compare('last-modified', [], [], true);
    compare('last-modified', [['-r'], ['-t'], ['-z']], ['-r', '-t', '-z'], true);
    compare(
      'last-modified',
      [['--max-depth', -1], ['--no-recursive']],
      ['--max-depth=-1', '--no-recursive'],
      true,
    );
    compare('last-modified', [['--combined-all-paths']], ['--combined-all-paths'], true);
    compare('last-modified', [['--maximal-only']], ['--maximal-only'], false);
    // Two positive revisions are rejected after object resolution, so this is not
    // represented as a raw arity rule: paths and negative revisions remain valid.
    const result = direct(['last-modified', 'HEAD', 'HEAD~']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('one commit at a time');
  });
  it.skipIf(legacy)('matches diff-pairs protocol and operand requirements', () => {
    compare('diff-pairs', [['-z']], ['-z'], true);
    compare('diff-pairs', [], [], false);
    compare('diff-pairs', [['-z'], { operand: 'HEAD' }], ['-z', 'HEAD'], false);
    compare('diff-pairs', [['-z'], ['--'], { operand: 'tracked' }], ['-z', '--', 'tracked'], false);
    compare(
      'diff-pairs',
      [['-z'], ['--name-only'], ['--name-status']],
      ['-z', '--name-only', '--name-status'],
      false,
    );
  });
  it.skipIf(legacy)('matches replay modes without updating fixture references', () => {
    const tail = [['--ref-action', 'print'], { operand: 'HEAD~..HEAD' }];
    const argv = ['--ref-action=print', 'HEAD~..HEAD'];
    compare('replay', [['--onto', 'HEAD~'], ...tail], ['--onto=HEAD~', ...argv], true);
    compare(
      'replay',
      [['--onto', 'HEAD~'], ['--reverse'], ...tail],
      ['--onto=HEAD~', '--reverse', ...argv],
      true,
    );
    compare('replay', tail, argv, false);
    compare(
      'replay',
      [['--onto', 'HEAD~'], ['--advance', 'HEAD'], ...tail],
      ['--onto=HEAD~', '--advance=HEAD', ...argv],
      false,
    );
    compare(
      'replay',
      [['--onto', ''], ['--revert', 'HEAD'], ...tail],
      ['--onto=', '--revert=HEAD', ...argv],
      false,
    );
    compare(
      'replay',
      [['--onto', 'HEAD~'], ['--contained'], ['--ref', 'refs/heads/out'], ...tail],
      ['--onto=HEAD~', '--contained', '--ref=refs/heads/out', ...argv],
      false,
    );
    compare('replay', [['--onto', 'HEAD~']], ['--onto=HEAD~'], false);
    compare(
      'replay',
      [['--onto', 'HEAD~'], ['--ref-action', 'PRINT'], { operand: 'HEAD~..HEAD' }],
      ['--onto=HEAD~', '--ref-action=PRINT', 'HEAD~..HEAD'],
      false,
    );
    compare(
      'replay',
      [['--onto', 'HEAD~'], ['--ref-action', 'invalid'], ...tail],
      ['--onto=HEAD~', '--ref-action=invalid', ...argv],
      true,
    );
  });
});
