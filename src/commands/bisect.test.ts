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

describe('bisect dispatch and term constraints', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-bisect-'));
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

  const reset = () => expect(direct(['bisect', 'reset']).status).toBe(0);
  const start = () => {
    reset();
    expect(direct(['bisect', 'start', '--no-checkout', 'HEAD', 'HEAD~5']).status).toBe(0);
  };

  it('validates final custom terms rather than rejecting overwritten values', () => {
    for (const [good, bad, valid] of [
      ['fixed', 'broken', true],
      ['same', 'same', false],
      ['good', 'good', false],
      ['bad', 'broken', false],
      ['old', 'new', true],
      ['start', 'broken', false],
      ['fixed', 'run', false],
      ['', 'broken', false],
      ['Upper/name', 'lower/name', true],
    ] as const) {
      reset();
      compare(
        'bisect start',
        [['--no-checkout'], ['--term-good', good], ['--term-bad', bad]],
        ['--no-checkout', `--term-good=${good}`, `--term-bad=${bad}`],
        valid,
      );
    }
    reset();
    compare(
      'bisect start',
      [
        ['--no-checkout'],
        ['--term-good', 'start'],
        ['--term-old', 'fixed'],
        ['--term-bad', 'broken'],
      ],
      ['--no-checkout', '--term-good=start', '--term-old=fixed', '--term-bad=broken'],
      true,
    );
    reset();
    compare(
      'bisect start',
      [['--no-checkout'], ['--term-good', 'same'], ['--term-bad', 'same'], ['--term-new', 'other']],
      ['--no-checkout', '--term-good=same', '--term-bad=same', '--term-new=other'],
      true,
    );
    reset();
  });
  it('retains custom root dispatch and all standard state aliases', () => {
    reset();
    expect(
      direct(['bisect', 'start', '--no-checkout', '--term-good=fixed', '--term-bad=broken']).status,
    ).toBe(0);
    compare('bisect', [{ operand: 'broken' }, { operand: 'HEAD' }], ['broken', 'HEAD'], true);
    compare('bisect', [{ operand: 'fixed' }, { operand: 'HEAD~5' }], ['fixed', 'HEAD~5'], true);
    reset();
    for (const [good, bad] of [
      ['good', 'bad'],
      ['old', 'new'],
    ] as const) {
      expect(direct(['bisect', 'start', '--no-checkout']).status).toBe(0);
      compare(`bisect ${bad}`, [{ operand: 'HEAD' }], ['HEAD'], true);
      compare(
        `bisect ${good}`,
        [{ operand: 'HEAD~5' }, { operand: 'HEAD~4' }],
        ['HEAD~5', 'HEAD~4'],
        true,
      );
      compare(
        `bisect ${bad}`,
        [{ operand: 'HEAD' }, { operand: 'HEAD~1' }],
        ['HEAD', 'HEAD~1'],
        false,
      );
      reset();
    }
    compare('bisect', [], [], false);
  });
  it('counts terms arguments rather than just distinct active flags', () => {
    start();
    compare('bisect terms', [], [], true);
    for (const flag of ['--term-good', '--term-old', '--term-bad', '--term-new']) {
      compare('bisect terms', [[flag]], [flag], true);
      compare('bisect terms', [[flag], [flag]], [flag, flag], false);
    }
    compare('bisect terms', [{ operand: 'good' }], ['good'], false);
    compare(
      'bisect terms',
      [['--term-good'], ['--term-bad']],
      ['--term-good', '--term-bad'],
      false,
    );
    reset();
  });
  it('matches operation arities and preserves literal delegated words', async () => {
    start();
    compare('bisect next', [{ operand: 'extra' }], ['extra'], false);
    compare('bisect next', [], [], true);
    compare('bisect log', [{ operand: '--ignored' }], ['--ignored'], true);
    compare('bisect reset', [{ operand: 'HEAD' }, { operand: 'HEAD' }], ['HEAD', 'HEAD'], false);
    compare('bisect replay', [], [], false);
    compare('bisect run', [], [], false);
    for (const op of ['view', 'visualize'] as const) {
      compare(`bisect ${op}`, [{ operand: '--oneline' }], ['--oneline'], true);
    }
    const log = direct(['bisect', 'log']).stdout;
    const path = join(root, 'replay');
    await writeFile(path, log);
    reset();
    compare('bisect replay', [{ operand: path }], [path], true);
    compare('bisect skip', [{ operand: 'HEAD~2' }], ['HEAD~2'], true);
    reset();
    start();
    compare('bisect run', [{ operand: 'true' }], ['true'], true);
    reset();
    compare('bisect reset', [], [], true);
  });
});
