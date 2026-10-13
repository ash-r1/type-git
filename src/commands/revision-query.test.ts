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
describe('revision queries and pull grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-query-'));
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

  it('preserves shortlog callbacks and own short options', () => {
    compare('shortlog', [['-n'], ['-s'], { operand: 'HEAD' }], ['-n', '-s', 'HEAD'], true);
    for (const width of ['', '76', '0,99,99', '12,0,0', ',,', ' +76,6,9']) {
      compare('shortlog', [['-w', width], { operand: 'HEAD' }], [`-w${width}`, 'HEAD'], true);
    }
    for (const width of ['9', '10,10,0', '-1', '0,0,0,0', ' ']) {
      compare('shortlog', [['-w', width], { operand: 'HEAD' }], [`-w${width}`, 'HEAD'], false);
    }
    if (!legacy) {
      for (const group of ['AUTHOR', 'CoMmItTeR', 'trailer:Reviewed-by', 'format:%aN', '%s']) {
        compare(
          'shortlog',
          [['--group', group], { operand: 'HEAD' }],
          [`--group=${group}`, 'HEAD'],
          true,
        );
      }
      for (const group of ['bad', 'TRAILER:Reviewed-by']) {
        compare(
          'shortlog',
          [['--group', group], ['--group', 'author'], { operand: 'HEAD' }],
          [`--group=${group}`, '--group=author', 'HEAD'],
          false,
        );
      }
    }
  });
  it('matches show-branch mode transitions without invented exclusions', () => {
    compare(
      'show-branch',
      [['--merge-base'], ['--independent'], { operand: 'HEAD' }],
      ['--merge-base', '--independent', 'HEAD'],
      true,
    );
    compare(
      'show-branch',
      [['--list'], ['--merge-base'], { operand: 'HEAD' }],
      ['--list', '--merge-base', 'HEAD'],
      false,
    );
    compare(
      'show-branch',
      [['--list'], ['--no-more'], ['--merge-base'], { operand: 'HEAD' }],
      ['--list', '--no-more', '--merge-base', 'HEAD'],
      true,
    );
    compare(
      'show-branch',
      [['--more'], ['--independent'], { operand: 'HEAD' }],
      ['--more', '--independent', 'HEAD'],
      false,
    );
    compare('show-branch', [['--reflog', '1'], ['--list']], ['--reflog=1', '--list'], true);
    compare(
      'show-branch',
      [
        ['--reflog', '1'],
        ['--more', 0],
      ],
      ['--reflog=1', '--more=0'],
      true,
    );
    compare('show-branch', [['--reflog', 'bad']], ['--reflog=bad'], false);
    if (!legacy) {
      // Git 2.25 crashes on this combination; Git 2.55 rejects it normally.
      compare(
        'show-branch',
        [['--reflog', '1'], ['--current']],
        ['--reflog=1', '--current'],
        false,
      );
    }
    compare(
      'show-branch',
      [['--reflog', '1'], { operand: 'HEAD' }, { operand: 'HEAD~' }],
      ['--reflog=1', 'HEAD', 'HEAD~'],
      false,
    );
  });
  it('matches pull parsing with local dry-run fetches', () => {
    const args = [['--dry-run'], { operand: '.' }, { operand: 'HEAD' }];
    const argv = ['--dry-run', '.', 'HEAD'];
    for (const rebase of ['true', 'FALSE', 'merges', 'm', 'interactive', 'i', '0x0', '1k']) {
      compare('pull', [['--rebase', rebase], ...args], [`--rebase=${rebase}`, ...argv], true);
    }
    compare(
      'pull',
      [['--rebase', 'MERGES'], ['--rebase', 'true'], ...args],
      ['--rebase=MERGES', '--rebase=true', ...argv],
      false,
    );
    compare('pull', [['--cleanup', 'invalid'], ...args], ['--cleanup=invalid', ...argv], false);
    compare(
      'pull',
      [['--cleanup', 'invalid'], ['--cleanup', 'strip'], ...args],
      ['--cleanup=invalid', '--cleanup=strip', ...argv],
      true,
    );
    compare('pull', [['--all'], ...args], ['--all', ...argv], false);
    compare(
      'pull',
      [['--depth', '1'], ['--unshallow'], ...args],
      ['--depth=1', '--unshallow', ...argv],
      false,
    );
    compare('pull', [['--squash'], ['--commit'], ...args], ['--squash', '--commit', ...argv], true);
  });
  it('matches rev-parse value grammars and required separate values', () => {
    compare('rev-parse', [['--verify'], { operand: 'HEAD' }], ['--verify', 'HEAD'], true);
    compare(
      'rev-parse',
      [['--short', 'nonsense'], { operand: 'HEAD' }],
      ['--short=nonsense', 'HEAD'],
      true,
    );
    compare('rev-parse', [['--git-path', 'objects']], ['--git-path', 'objects'], true);
    compare(
      'rev-parse',
      [['--default', 'HEAD'], ['--verify']],
      ['--default', 'HEAD', '--verify'],
      true,
    );
    compare(
      'rev-parse',
      [['--abbrev-ref', 'loose'], { operand: 'HEAD' }],
      ['--abbrev-ref=loose', 'HEAD'],
      true,
    );
    compare(
      'rev-parse',
      [
        ['--abbrev-ref', 'bad'],
        ['--abbrev-ref', 'strict'],
      ],
      ['--abbrev-ref=bad', '--abbrev-ref=strict'],
      false,
    );
    if (!legacy) {
      compare(
        'rev-parse',
        [['--path-format', 'absolute'], ['--git-dir']],
        ['--path-format=absolute', '--git-dir'],
        true,
      );
      compare('rev-parse', [['--path-format', 'ABSOLUTE']], ['--path-format=ABSOLUTE'], false);
      compare(
        'rev-parse',
        [['--show-object-format', 'storage']],
        ['--show-object-format=storage'],
        true,
      );
      compare('rev-parse', [['--show-object-format', 'bad']], ['--show-object-format=bad'], false);
    }
  });
  it('matches rev-parse early dispatch and quoting operands', () => {
    const usage = 'test [options]\n--\nf,flag  test flag\n';
    compare('rev-parse --parseopt', [['--'], { operand: '-f' }], ['--', '-f'], true, usage);
    compare('rev-parse --parseopt', [], [], false);
    compare('rev-parse --parseopt', [{ operand: 'extra' }, ['--']], ['extra', '--'], false);
    compare(
      'rev-parse --sq-quote',
      [{ operand: '--help' }, { operand: 'a b' }],
      ['--help', 'a b'],
      true,
    );
    compare('rev-parse --sq-quote', [], [], true);
  });
  it('preserves native aliases and version-specific deprecated-command opt-in', () => {
    compare('pickaxe', [{ operand: 'tracked' }], ['tracked'], true);
    compare(
      'pickaxe',
      [['--progress'], ['--porcelain'], { operand: 'tracked' }],
      ['--progress', '--porcelain', 'tracked'],
      false,
    );
    if (!legacy) {
      compare('whatchanged', [['--i-still-use-this']], ['--i-still-use-this'], true);
      compare('whatchanged', [], [], false);
    }
  });
});
