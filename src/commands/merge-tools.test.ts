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

describe('merge strategies and tool frontends', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-merge-tools-'));
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
      GIT_ALLOW_PROTOCOL: 'file',
      LC_ALL: 'C',
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
    for (const [key, value] of [
      ['help.format', 'man'],
      ['man.viewer', 'fixture'],
      ['man.fixture.cmd', 'true'],
      ['difftool.fixture.cmd', 'true'],
    ]) {
      expect(direct(['config', key, value]).status).toBe(0);
    }
    for (let i = 0; i < 4; i++) {
      expect(direct(['commit', '--allow-empty', '-m', `step ${i}`]).status).toBe(0);
    }
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

  it('dispatches first-position help before the manual merge parser', async () => {
    for (const command of [
      'merge-recursive',
      'merge-recursive-ours',
      'merge-recursive-theirs',
      'merge-subtree',
    ] as const) {
      compare(command, [['--help']], ['--help'], true);
      compare(command, [['--help'], ['--']], ['--help', '--'], true);
      compare(command, [['--ours'], ['--help']], ['--ours', '--help'], false);
      const actual = await repo.command(command, [['--help']]);
      expect(actual.exitCode, actual.stderr).toBe(0);
      expect(actual.aborted).toBe(false);
    }
  });
  it('requires exactly two heads after a separator for every recursive alias', () => {
    for (const command of [
      'merge-recursive',
      'merge-recursive-ours',
      'merge-recursive-theirs',
      'merge-subtree',
    ] as const) {
      compare(
        command,
        [['--'], { operand: 'HEAD' }, { operand: 'HEAD' }],
        ['--', 'HEAD', 'HEAD'],
        true,
      );
      compare(
        command,
        [{ operand: 'HEAD' }, { operand: 'HEAD' }, { operand: 'HEAD' }],
        ['HEAD', 'HEAD', 'HEAD'],
        false,
      );
      compare(command, [['--'], { operand: 'HEAD' }], ['--', 'HEAD'], false);
      compare(
        command,
        [['--'], { operand: 'HEAD' }, { operand: 'HEAD' }, { operand: 'HEAD' }],
        ['--', 'HEAD', 'HEAD', 'HEAD'],
        false,
      );
    }
    const bases = Array.from({ length: 22 }, () => ({ operand: 'HEAD' }));
    compare(
      'merge-recursive',
      [...bases, ['--'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      [...Array(22).fill('HEAD'), '--', 'HEAD', 'HEAD'],
      true,
    );
  });
  it('preserves ordered strategy replacement and algorithm callback case rules', () => {
    compare(
      'merge-recursive',
      [
        ['--ours'],
        ['--theirs'],
        ['--diff-algorithm', 'MYERS'],
        ['--'],
        { operand: 'HEAD' },
        { operand: 'HEAD' },
      ],
      ['--ours', '--theirs', '--diff-algorithm=MYERS', '--', 'HEAD', 'HEAD'],
      true,
    );
    compare(
      'merge-recursive',
      [
        ['--diff-algorithm', 'unknown'],
        ['--diff-algorithm', 'myers'],
        ['--'],
        { operand: 'HEAD' },
        { operand: 'HEAD' },
      ],
      ['--diff-algorithm=unknown', '--diff-algorithm=myers', '--', 'HEAD', 'HEAD'],
      false,
    );
  });
  it('preserves merge-index native word count including no-work invocations', () => {
    compare('merge-index', [{ operand: 'true' }], ['true'], false);
    compare('merge-index', [['-o'], { operand: 'true' }], ['-o', 'true'], true);
    compare('merge-index', [{ operand: 'true' }, ['-a']], ['true', '-a'], true);
    compare(
      'merge-index',
      [['-o'], ['-q'], { operand: 'true' }, ['--'], { operand: 'tracked' }],
      ['-o', '-q', 'true', '--', 'tracked'],
      true,
    );
  });
  it('honors difftool help before deferred diff and tool checks', () => {
    compare(
      'difftool',
      [['--extcmd', 'true'], ['--no-prompt'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--extcmd=true', '--no-prompt', 'HEAD', 'HEAD'],
      true,
    );
    compare(
      'difftool',
      [['--gui'], ['--tool', 'fixture'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--gui', '--tool=fixture', 'HEAD', 'HEAD'],
      false,
    );
    compare(
      'difftool',
      [['--tool', 'fixture'], ['--extcmd', 'true'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--tool=fixture', '--extcmd=true', 'HEAD', 'HEAD'],
      false,
    );
    compare(
      'difftool',
      [['--tool-help'], ['--gui'], ['--tool', 'unused'], ['--diff-algorithm', 'unknown']],
      ['--tool-help', '--gui', '--tool=unused', '--diff-algorithm=unknown'],
      true,
    );
    compare(
      'difftool',
      [['--tool', 'fixture'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--tool=fixture', 'HEAD', 'HEAD'],
      true,
    );
    compare('difftool', [['--extcmd', '']], ['--extcmd='], false);
    compare(
      'difftool',
      [['--extcmd', ''], ['--extcmd', 'true'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--extcmd=', '--extcmd=true', 'HEAD', 'HEAD'],
      true,
    );
    compare('difftool', [['--dir-diff'], ['--no-index']], ['--dir-diff', '--no-index'], false);
  });
  it('preserves mergetool selection and ignored request-pull tail arguments', () => {
    compare(
      'mergetool',
      [['--tool', 'unused'], ['--gui'], ['--no-prompt']],
      ['--tool=unused', '--gui', '--no-prompt'],
      true,
    );
    compare('request-pull', [{ operand: 'HEAD' }], ['HEAD'], false);
    compare(
      'request-pull',
      [{ operand: '' }, { operand: repo.workdir }],
      ['', repo.workdir],
      false,
    );
    compare(
      'request-pull',
      [
        { operand: 'HEAD~1' },
        { operand: repo.workdir },
        { operand: 'HEAD' },
        { operand: 'ignored' },
      ],
      ['HEAD~1', repo.workdir, 'HEAD', 'ignored'],
      true,
    );
    compare(
      'request-pull',
      [{ operand: 'HEAD~1' }, ['-p'], { operand: repo.workdir }, { operand: 'HEAD' }],
      ['HEAD~1', '-p', repo.workdir, 'HEAD'],
      true,
    );
  });
});
