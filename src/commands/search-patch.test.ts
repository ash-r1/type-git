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
describe('search, attribution, patch and archive grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-search-patch-'));
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
    successStatus = 0,
  ) => {
    const actual = direct([...command.split(' '), ...argv], input);
    const label = `${command} ${argv.join(' ')}: ${actual.stderr}`;
    expect(actual.signal, label).toBe(null);
    expect(actual.error, label).toBeUndefined();
    expect(actual.status === successStatus, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([...command.split(' '), ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };

  it('matches blame and annotate output flags and legacy operand forms', () => {
    for (const command of ['blame', 'annotate'] as const) {
      compare(command, [{ operand: 'tracked' }], ['tracked'], true);
      compare(
        command,
        [['--'], { operand: 'tracked' }, { operand: 'HEAD' }],
        ['--', 'tracked', 'HEAD'],
        true,
      );
      compare(
        command,
        [['--diff-algorithm', 'DeFaUlT'], { operand: 'tracked' }],
        ['--diff-algorithm=DeFaUlT', 'tracked'],
        true,
      );
      compare(
        command,
        [['--progress'], ['--porcelain'], { operand: 'tracked' }],
        ['--progress', '--porcelain', 'tracked'],
        false,
      );
      compare(
        command,
        [['--progress'], ['--incremental'], { operand: 'tracked' }],
        ['--progress', '--incremental', 'tracked'],
        false,
      );
      compare(
        command,
        [['--line-porcelain'], ['--no-porcelain'], ['--progress'], { operand: 'tracked' }],
        ['--line-porcelain', '--no-porcelain', '--progress', 'tracked'],
        true,
      );
      compare(
        command,
        [['--porcelain'], ['--no-line-porcelain'], ['--progress'], { operand: 'tracked' }],
        ['--porcelain', '--no-line-porcelain', '--progress', 'tracked'],
        true,
      );
      compare(
        command,
        [
          ['--reverse'],
          ['--contents', '-'],
          { operand: 'HEAD~..HEAD' },
          ['--'],
          { operand: 'tracked' },
        ],
        ['--reverse', '--contents=-', 'HEAD~..HEAD', '--', 'tracked'],
        false,
      );
      compare(command, [], [], false);
      compare(
        command,
        [{ operand: 'HEAD' }, ['--'], { operand: 'tracked' }, { operand: 'HEAD' }],
        ['HEAD', '--', 'tracked', 'HEAD'],
        false,
      );
    }
  });
  it('matches grep source selection, required patterns and numeric shorthand', () => {
    compare('grep', [{ operand: 'changed' }], ['changed'], true);
    compare('grep', [['-e', 'changed']], ['-e', 'changed'], true);
    compare('grep', [['--'], { operand: 'changed' }], ['--', 'changed'], true);
    for (const flag of ['-0', '-12', '-001']) {
      compare('grep', [[flag], { operand: 'changed' }], [flag, 'changed'], true);
    }
    compare('grep', [], [], false);
    if (!legacy) {
      // Git 2.25 lets these modes take precedence instead of rejecting them.
      compare(
        'grep',
        [['--cached'], ['--untracked'], { operand: 'changed' }],
        ['--cached', '--untracked', 'changed'],
        false,
      );
      compare(
        'grep',
        [['--no-index'], ['--cached'], { operand: 'changed' }],
        ['--no-index', '--cached', 'changed'],
        false,
      );
    }
    compare(
      'grep',
      [['--exclude-standard'], { operand: 'changed' }],
      ['--exclude-standard', 'changed'],
      false,
    );
    compare(
      'grep',
      [['--no-exclude-standard'], { operand: 'changed' }],
      ['--no-exclude-standard', 'changed'],
      false,
    );
    compare(
      'grep',
      [['--untracked'], ['--recurse-submodules'], { operand: 'changed' }],
      ['--untracked', '--recurse-submodules', 'changed'],
      false,
    );
    compare(
      'grep',
      [['--threads', -1], { operand: 'changed' }],
      ['--threads=-1', 'changed'],
      false,
    );
    compare(
      'grep',
      [['--threads', -1], ['--no-threads'], { operand: 'changed' }],
      ['--threads=-1', '--no-threads', 'changed'],
      true,
    );
    if (!legacy) {
      // A zero match limit returns 1 before source-conflict and thread validation.
      compare(
        'grep',
        [
          ['--max-count', 0],
          ['--cached'],
          ['--untracked'],
          ['--threads', -1],
          { operand: 'changed' },
        ],
        ['--max-count=0', '--cached', '--untracked', '--threads=-1', 'changed'],
        true,
        '',
        1,
      );
    }
  });
  it('matches format-patch callback ordering and output restrictions', () => {
    const tail = [['--stdout'], { operand: 'HEAD~..HEAD' }];
    const argv = ['--stdout', 'HEAD~..HEAD'];
    compare('format-patch', tail, argv, true);
    compare('format-patch', [['-n'], ['-k'], ...tail], ['-n', '-k', ...argv], false);
    compare('format-patch', [['-n'], ['-N'], ['-k'], ...tail], ['-n', '-N', '-k', ...argv], true);
    compare(
      'format-patch',
      [['--subject-prefix', ''], ['-k'], ...tail],
      ['--subject-prefix=', '-k', ...argv],
      false,
    );
    compare('format-patch', [['--rfc'], ['-k'], ...tail], ['--rfc', '-k', ...argv], false);
    if (!legacy) {
      compare('format-patch', [['--rfc', ''], ['-k'], ...tail], ['--rfc=', '-k', ...argv], true);
      compare(
        'format-patch',
        [['--cover-from-description', 'invalid'], ['--cover-from-description', 'auto'], ...tail],
        ['--cover-from-description=invalid', '--cover-from-description=auto', ...argv],
        true,
      );
    }
    compare('format-patch', [['--thread', 'DEEP'], ...tail], ['--thread=DEEP', ...argv], false);
    compare(
      'format-patch',
      [['--output-directory', root], ['--output-directory', root], { operand: 'HEAD~..HEAD' }],
      [`--output-directory=${root}`, `--output-directory=${root}`, 'HEAD~..HEAD'],
      false,
    );
    compare(
      'format-patch',
      [['--output-directory', root], ...tail],
      [`--output-directory=${root}`, ...argv],
      false,
    );
    for (const flag of ['--name-only', '--name-status', '--check']) {
      compare('format-patch', [[flag], ...tail], [flag, ...argv], false);
    }
  });
  it('matches archive listing and preserves locally ignored exec selection', () => {
    compare('archive', [['--list']], ['--list'], true);
    compare(
      'archive',
      [['--list'], ['--exec', 'not-executed']],
      ['--list', '--exec=not-executed'],
      true,
    );
    compare('archive', [], [], false);
    if (!legacy) {
      // Git 2.25 ignores operands in listing mode.
      compare('archive', [['--list'], { operand: 'HEAD' }], ['--list', 'HEAD'], false);
    }
    const file = join(root, 'test.zip');
    compare(
      'archive',
      [['--format', 'zip'], ['-9'], ['--output', file], { operand: 'HEAD' }],
      ['--format=zip', '-9', `--output=${file}`, 'HEAD'],
      true,
    );
    // Listing exits before the selected format or compression level is checked.
    compare(
      'archive',
      [['--format', 'unknown'], ['-123'], ['--list']],
      ['--format=unknown', '-123', '--list'],
      true,
    );
    expect(() => commandArguments('archive', [['-1.5'], ['--list']], true)).toThrow(
      GitArgumentError,
    );
  });
});
