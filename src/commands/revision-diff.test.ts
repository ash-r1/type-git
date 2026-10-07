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
describe('revision and diff parser constraints', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-revision-diff-'));
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
    await repo.add('tracked');
    await repo.commit({ message: 'initial' });
    await writeFile(join(repo.workdir, 'tracked'), 'two\n');
    await repo.add('tracked');
    await repo.commit({ message: 'second' });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
  const compare = (command: GitCommandName, args: readonly unknown[], argv: string[]) => {
    const actual = direct([command, ...argv]);
    if (actual.status === 0) {
      expect(commandArguments(command, args), argv.join(' ')).toEqual([command, ...argv]);
    } else {
      expect(() => commandArguments(command, args), `${argv.join(' ')}: ${actual.stderr}`).toThrow(
        GitArgumentError,
      );
    }
  };
  it.skipIf(legacy)(
    'matches all ordered output-format pairs and selected resetting triples',
    () => {
      const outputFlags = ['--name-only', '--name-status', '--check', '-s', '-p', '--no-no-patch'];
      for (const a of outputFlags) {
        for (const b of outputFlags) {
          compare('diff', [[a], [b]], [a, b]);
        }
      }
      for (const flags of [
        ['--name-only', '-s', '--name-status'],
        ['-s', '--name-only', '-p'],
        ['--name-only', '--name-status', '-s'],
        ['--name-only', '--name-status', '-p'],
        ['-s', '--name-only', '--stat'],
        ['-s', '--name-only', '--binary'],
        ['-s', '--name-only', '--dirstat'],
        ['-s', '--name-only', '--cumulative'],
        ['-s', '--name-only', '--dirstat-by-file'],
      ]) {
        compare(
          'diff',
          flags.map((f) => [f]),
          flags,
        );
      }
    },
  );
  it.skipIf(legacy)('matches traversal toggles and immediate, asymmetric cherry selection', () => {
    for (const flags of [
      ['--graph', '--reverse'],
      ['--graph', '--reverse', '--reverse'],
      ['--graph', '--reverse', '--no-graph'],
      ['--walk-reflogs', '--reverse'],
      ['--graph', '--children'],
      ['--graph', '--no-graph', '--children'],
      ['--parents', '--children'],
      ['--walk-reflogs', '--ancestry-path'],
      ['--cherry-mark', '--cherry-pick'],
      ['--cherry-pick', '--cherry'],
      ['--cherry', '--cherry-pick'],
      ['--cherry', '--left-only'],
      ['--left-only', '--right-only'],
      ['--graph', '--show-linear-break'],
      ['--stdin', '--stdin'],
    ]) {
      compare(
        'log',
        flags.map((f) => [f]),
        flags,
      );
    }
    compare('log', [['--grep-reflog', 'initial']], ['--grep-reflog=initial']);
    compare(
      'log',
      [['--walk-reflogs'], ['--grep-reflog', 'initial']],
      ['--walk-reflogs', '--grep-reflog=initial'],
    );
  });
  it.skipIf(legacy)(
    'retains the max-count-oldest transition rules instead of a final-state exclusion',
    () => {
      const options: [string, number][] = [
        ['--max-count', 1],
        ['--max-count', -1],
        ['--max-count-oldest', 1],
        ['--skip', 0],
        ['--skip', 1],
        ['-n', 1],
        ['-n', -1],
      ];
      for (const a of options) {
        for (const b of options) {
          // Git 2.55.0 parses this pair but crashes in oldest traversal (SIGSEGV).
          // It is not a parser rejection; keep it out of the acceptance/error oracle.
          if (a[0] === '--max-count-oldest' && b[0] === '-n' && b[1] === -1) {
            continue;
          }
          const args = [a, b];
          const argv = args.flatMap(([flag, value]) =>
            flag === '-n' ? [flag, String(value)] : [`${flag}=${value}`],
          );
          compare('log', args, argv);
        }
      }
      compare(
        'log',
        [
          ['--max-count-oldest', 1],
          ['--skip', 0],
          ['--max-count', 1],
        ],
        ['--max-count-oldest=1', '--skip=0', '--max-count=1'],
      );
    },
  );
  it.skipIf(legacy)('checks pickaxe and callback enums before later values can mask errors', () => {
    for (const [args, argv] of [
      [
        [
          ['-S', 'one'],
          ['-G', 'two'],
        ],
        ['-S', 'one', '-G', 'two'],
      ],
      [
        [['-G', 'one'], ['--pickaxe-regex']],
        ['-G', 'one', '--pickaxe-regex'],
      ],
      [
        [['-S', 'one'], ['--pickaxe-regex']],
        ['-S', 'one', '--pickaxe-regex'],
      ],
      [
        [
          ['-S', ''],
          ['-S', 'one'],
        ],
        ['-S', '', '-S', 'one'],
      ],
      [
        [
          ['--diff-algorithm', 'invalid'],
          ['--diff-algorithm', 'myers'],
        ],
        ['--diff-algorithm=invalid', '--diff-algorithm=myers'],
      ],
      [[['--word-diff', 'invalid']], ['--word-diff=invalid']],
      [[['--ignore-submodules', 'invalid']], ['--ignore-submodules=invalid']],
    ] as const) {
      compare('diff', args, [...argv]);
    }
  });
  it.skipIf(legacy)('resets combined-all-paths when a later merge-diff mode replaces it', () => {
    for (const flags of [
      ['--combined-all-paths'],
      ['-c', '--combined-all-paths'],
      ['--combined-all-paths', '--dd'],
      ['--dd', '--combined-all-paths'],
      ['-c', '--combined-all-paths', '--no-diff-merges'],
      ['--no-diff-merges', '--combined-all-paths'],
    ]) {
      for (const name of ['log', 'show', 'diff-tree'] as const) {
        compare(name, [...flags.map((f) => [f]), { operand: 'HEAD' }], [...flags, 'HEAD']);
      }
    }
  });
  it.skipIf(legacy)(
    'requires object enumeration for active filters and permits clearing the filter',
    () => {
      compare('log', [['--filter', 'blob:none']], ['--filter=blob:none']);
      compare(
        'log',
        [['--filter', 'blob:none'], ['--objects']],
        ['--filter=blob:none', '--objects'],
      );
      compare(
        'log',
        [['--filter', 'blob:none'], ['--no-filter']],
        ['--filter=blob:none', '--no-filter'],
      );
    },
  );
  it('executes each new command and preserves detached --default values', async () => {
    expect(
      (
        await repo.command('log', [
          ['--default', 'HEAD'],
          ['--format', '%s'],
        ])
      ).stdout,
    ).toBe('second\ninitial\n');
    expect((await repo.command('show', [['--no-patch'], ['--format', '%s']])).stdout).toBe(
      'second\n',
    );
    expect((await repo.command('diff', [])).exitCode).toBe(0);
    expect((await repo.command('diff-files', [])).exitCode).toBe(0);
    expect((await repo.command('diff-index', [{ operand: 'HEAD' }])).exitCode).toBe(0);
    expect((await repo.command('diff-tree', [{ operand: 'HEAD' }])).exitCode).toBe(0);
    expect(() => commandArguments('log', [['--max-count', 2147483648]])).toThrow(GitArgumentError);
    expect(() => commandArguments('log', [['--expand-tabs', -1]])).toThrow(GitArgumentError);
  });
  it('uses a separate no-index grammar and enforces its two required paths', async () => {
    expect(
      (await repo.command('diff --no-index', [{ operand: 'tracked' }, { operand: 'tracked' }]))
        .exitCode,
    ).toBe(0);
    expect(() => commandArguments('diff --no-index', [{ operand: 'tracked' }])).toThrow(
      GitArgumentError,
    );
    expect(direct(['diff', '--no-index', 'tracked']).status).not.toBe(0);
    expect(() =>
      commandArguments('diff --no-index', [
        ['--graph'],
        { operand: 'tracked' },
        { operand: 'tracked' },
      ]),
    ).toThrow(GitArgumentError);
  });
  it.skipIf(legacy)(
    'preserves filename state across negation but clears it with an empty filename',
    async () => {
      // Commit file/message exclusivity exposes the underlying OPTION_FILENAME state.
      expect(() =>
        commandArguments('commit', [['--file', 'message'], ['--no-file'], ['--message', 'text']]),
      ).toThrow(GitArgumentError);
      expect(
        commandArguments('commit', [
          ['--file', 'message'],
          ['--file', ''],
          ['--message', 'text'],
        ]),
      ).toEqual(['commit', '--file=message', '--file=', '--message=text']);
      const message = join(root, 'message');
      await writeFile(message, 'message text');
      const actual = direct([
        'commit',
        '--dry-run',
        `--file=${message}`,
        '--no-file',
        '--message=text',
      ]);
      expect(actual.status).not.toBe(0);
      expect(actual.stderr).toContain('cannot be used together');
    },
  );
});
