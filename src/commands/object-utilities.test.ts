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
describe('object and utility command grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-object-utilities-'));
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

  it('matches single-object and batch cat-file modes without rejecting ignored operands', async () => {
    compare('cat-file', [['-t'], { operand: 'HEAD' }], ['-t', 'HEAD'], true);
    compare('cat-file', [{ operand: 'commit' }, { operand: 'HEAD' }], ['commit', 'HEAD'], true);
    compare('cat-file', [['--batch-check']], ['--batch-check'], true, 'HEAD\n');
    compare('cat-file', [['--batch'], ['--batch']], ['--batch', '--batch'], false);
    compare(
      'cat-file',
      [['--batch'], ['--batch-check'], ['-h']],
      ['--batch', '--batch-check', '-h'],
      false,
    );
    compare('cat-file', [['-s'], ['--batch']], ['-s', '--batch'], false);
    compare('cat-file', [['--batch-check'], { operand: 'HEAD' }], ['--batch-check', 'HEAD'], false);
    if (!legacy) {
      compare(
        'cat-file',
        [['--no-buffer'], ['-t'], { operand: 'HEAD' }],
        ['--no-buffer', '-t', 'HEAD'],
        false,
      );
    }
    compare(
      'cat-file',
      [['--unordered'], ['-t'], { operand: 'HEAD' }],
      ['--unordered', '-t', 'HEAD'],
      true,
    );
    if (!legacy) {
      compare(
        'cat-file',
        [['--batch'], ['--textconv'], ['--path', 'tracked'], { operand: 'ignored' }],
        ['--batch', '--textconv', '--path=tracked', 'ignored'],
        true,
      );
    }
    compare(
      'cat-file',
      [['--path', 'tracked'], ['-t'], { operand: 'HEAD' }],
      ['--path=tracked', '-t', 'HEAD'],
      false,
    );
    const result = await repo.command('cat-file', [['--batch-check']], { stdin: 'HEAD\n' });
    expect(result.stdout).toContain(' commit ');
  });

  it.skipIf(legacy)('matches repack reachability strategies and MIDX callback values', () => {
    compare(
      'repack',
      [['-a'], ['-b'], ['--no-write-midx'], { operand: 'ignored' }],
      ['-a', '-b', '--no-write-midx', 'ignored'],
      true,
    );
    compare('repack', [['--write-midx', '']], ['--write-midx='], true);
    compare('repack', [['--write-midx', 'incremental']], ['--write-midx=incremental'], true);
    compare(
      'repack',
      [['--write-midx', 'bad'], ['--no-write-midx']],
      ['--write-midx=bad', '--no-write-midx'],
      false,
    );
    compare('repack', [['-A'], ['--cruft']], ['-A', '--cruft'], false);
    compare(
      'repack',
      [['--keep-unreachable'], ['--unpack-unreachable', 'now']],
      ['--keep-unreachable', '--unpack-unreachable=now'],
      false,
    );
    compare('repack', [['-b'], ['--no-write-midx']], ['-b', '--no-write-midx'], false);
    compare('repack', [['--geometric', 2], ['-a']], ['--geometric=2', '-a'], false);
    compare(
      'repack',
      [['--filter-to', join(root, 'out')]],
      [`--filter-to=${join(root, 'out')}`],
      false,
    );
    compare('repack', [['-b']], ['-b'], false);
    compare('repack', [['-b'], ['-m']], ['-b', '-m'], true);
  });

  it('matches explicit and implicit replacement modes', () => {
    const a = direct(['hash-object', '-w', '--stdin'], 'a').stdout.trim();
    const b = direct(['hash-object', '-w', '--stdin'], 'b').stdout.trim();
    compare('replace', [], [], true);
    compare('replace', [{ operand: a }, { operand: b }], [a, b], true);
    compare('replace', [['--list'], ['--format', '']], ['--list', '--format='], true);
    compare(
      'replace',
      [
        ['--format', 'invalid'],
        ['--format', 'short'],
      ],
      ['--format=invalid', '--format=short'],
      true,
    );
    compare('replace', [['--delete'], { operand: a }], ['--delete', a], true);
    compare('replace', [['--force']], ['--force'], false);
    compare('replace', [{ operand: a }], [a], false);
    compare('replace', [['--raw'], { operand: a }, { operand: b }], ['--raw', a, b], false);
    compare(
      'replace',
      [['--delete'], ['--format', 'short'], { operand: a }],
      ['--delete', '--format=short', a],
      false,
    );
    compare('replace', [['--edit'], ['--list'], ['-h']], ['--edit', '--list', '-h'], false);
  });

  it('models rerere operations without inventing trailing-argument restrictions', () => {
    expect(direct(['config', 'rerere.enabled', 'true']).status).toBe(0);
    compare('rerere', [], [], true);
    compare('rerere', [{ operand: 'unknown' }], ['unknown'], false);
    for (const op of [
      'rerere clear',
      'rerere diff',
      'rerere status',
      'rerere remaining',
      'rerere gc',
    ] as const) {
      compare(op, [{ operand: 'ignored' }], ['ignored'], true);
    }
    compare('rerere forget', [], [], true);
  });

  it('matches scalar utility arguments and native variable names', async () => {
    if (!legacy) {
      compare('column', [['--padding', -1]], ['--padding=-1'], false);
    }
    compare(
      'column',
      [
        ['--mode', 'column'],
        ['--width', 40],
      ],
      ['--mode=column', '--width=40'],
      true,
      'a\nb\n',
    );
    compare('column', [{ operand: 'extra' }], ['extra'], false);
    compare(
      'fmt-merge-msg',
      [
        ['--log', -1],
        ['-m', 'message'],
      ],
      ['--log=-1', '-m', 'message'],
      true,
    );
    compare('fmt-merge-msg', [{ operand: 'extra' }], ['extra'], false);
    compare(
      'version',
      [['--build-options'], { operand: 'ignored' }],
      ['--build-options', 'ignored'],
      true,
    );
    compare('var', [['-l']], ['-l'], true);
    compare('var', [{ operand: 'GIT_AUTHOR_IDENT' }], ['GIT_AUTHOR_IDENT'], true);
    compare('var', [{ operand: 'UNKNOWN' }], ['UNKNOWN'], false);
    compare('var', [['-l'], ['-l']], ['-l', '-l'], false);
    const result = await repo.command('version', []);
    expect(result.stdout).toContain('git version');
  });

  it.skipIf(legacy)('uses fixture-local configuration and diagnostic output paths', () => {
    compare('for-each-repo', [['--config', 'test.absent']], ['--config=test.absent'], true);
    compare('for-each-repo', [{ operand: 'status' }], ['status'], false);
    expect(direct(['config', 'test.repos', repo.workdir]).status).toBe(0);
    compare(
      'for-each-repo',
      [['--config', 'test.repos'], { operand: 'status' }, { operand: '--short' }],
      ['--config=test.repos', 'status', '--short'],
      true,
    );
    compare(
      'bugreport',
      [
        ['--output-directory', root],
        ['--suffix', 'test'],
      ],
      [`--output-directory=${root}`, '--suffix=test'],
      true,
    );
    compare(
      'bugreport',
      [['--diagnose', 'invalid'], ['--no-diagnose']],
      ['--diagnose=invalid', '--no-diagnose'],
      false,
    );
    compare('bugreport', [{ operand: 'extra' }], ['extra'], false);
    compare(
      'diagnose',
      [
        ['--output-directory', root],
        ['--suffix', 'test'],
        ['--mode', 'stats'],
        { operand: 'ignored' },
      ],
      [`--output-directory=${root}`, '--suffix=test', '--mode=stats', 'ignored'],
      true,
    );
    compare('diagnose', [['--mode', 'STATS'], ['-h']], ['--mode=STATS', '-h'], false);
  });
});
