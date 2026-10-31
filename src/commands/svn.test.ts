import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import svnDispatchBoundaries from '../../test/fixtures/svn-dispatch-boundaries.json';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { svnDispatch } from './svn-dispatch.js';

/** Skip only missing clients or Perl bindings; fail unexpected native probe errors. */
function nativeAvailable(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    console.warn(`Skipping native SVN comparisons: ${command} is not installed.`);
    return false;
  }
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).not.toBeNull();
  if (command === 'git' && result.stderr.includes("git: 'svn' is not a git command")) {
    expect(result.status).toBe(1);
    return false;
  }
  if (command === 'git' && /Can't locate SVN\/Core\.pm/.test(result.stderr)) {
    expect(result.status).toBe(2);
    console.warn('Skipping native SVN comparisons: Perl SVN::Core is unavailable.');
    return false;
  }
  expect(result.status, result.stderr).toBe(0);
  return true;
}
const available = nativeAvailable('git', ['svn', '--version']);
const localAvailable =
  available &&
  nativeAvailable('svn', ['--version', '--quiet']) &&
  nativeAvailable('svnadmin', ['--version', '--quiet']);
const operations = Object.keys(COMMAND_SPECS)
  .filter((name) => name.startsWith('svn '))
  .map((name) => name.slice(4));

/** Run a check in an isolated file:// SVN fixture and remove it even when the check fails. */
async function withLocalSvn(
  check: (fixture: {
    root: string;
    url: string;
    git: TypeGit;
    repo: WorktreeRepo;
  }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), 'type-git-svn-local-'));
  const env = {
    ...process.env,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_GLOBAL: join(root, 'global'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_PAGER: 'cat',
  };
  const source = join(root, 'svn');
  const url = pathToFileURL(source).href;
  try {
    expect(spawnSync('svnadmin', ['create', source], { env }).status).toBe(0);
    expect(
      spawnSync(
        'svn',
        ['mkdir', `${url}/trunk`, `${url}/branches`, `${url}/tags`, '-m', 'fixture'],
        { env },
      ).status,
    ).toBe(0);
    const git = new TypeGit({ inheritEnv: false, env });
    await git.command('svn clone', [
      ['--stdlayout'],
      { operand: url },
      { operand: join(root, 'repo') },
    ]);
    const repo = await git.open(join(root, 'repo'));
    await check({ root, url, git, repo });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe('Subversion operation tables', () => {
  const shapes = new Map<string, Map<string, { command: string; flag: string; value: string }>>();
  for (const [command, spec] of Object.entries(COMMAND_SPECS)) {
    if (!command.startsWith('svn ')) {
      continue;
    }
    for (const [flag, option] of Object.entries(spec.options)) {
      const values = shapes.get(flag) ?? new Map();
      if (!values.has(option.value)) {
        values.set(option.value, { command, flag, value: option.value });
      }
      shapes.set(flag, values);
    }
  }
  const collisions = [...shapes.values()]
    .filter((values) => values.size > 1)
    .flatMap((values) => [...values.values()]);
  for (const entry of collisions) {
    for (const named of [false, true]) {
      it.skipIf(!available)(
        `preserves ${entry.command} ${entry.flag} ${entry.value} through ${named ? 'named' : 'root'} dispatch`,
        async () => {
          const root = await mkdtemp(join(tmpdir(), 'type-git-svn-option-shape-'));
          const env = {
            ...process.env,
            HOME: root,
            XDG_CONFIG_HOME: root,
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: join(root, 'missing'),
            LC_ALL: 'C',
            PERL_HASH_SEED: '0',
            PERL_PERTURB_KEYS: '0',
          };
          const token =
            entry.value === 'flag'
              ? [entry.flag]
              : [entry.flag, entry.value === 'integer' ? 1 : '1'];
          const words =
            token.length === 1
              ? [entry.flag]
              : entry.flag.startsWith('--')
                ? [`${entry.flag}=${token[1]}`]
                : [entry.flag, String(token[1])];
          try {
            expect(spawnSync('git', ['init', '-q', root], { env }).status).toBe(0);
            const native = spawnSync('git', ['svn', entry.command.slice(4), ...words, '-h'], {
              cwd: root,
              env,
              encoding: 'utf8',
              timeout: 10000,
            });
            expect(native.error).toBeUndefined();
            expect(native.signal).toBeNull();
            expect(native.status, native.stderr).toBe(0);
            const repo = await new TypeGit({ inheritEnv: false, env }).open(root);
            const actual = await repo.command(
              (named ? entry.command : 'svn') as never,
              [...(named ? [] : [{ operand: entry.command.slice(4) }]), token, ['-h']] as never,
            );
            expect(actual.exitCode).toBe(native.status);
            expect(actual.stdout).toBe(native.stdout);
            expect(actual.stderr).toBe(native.stderr);
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        },
      );
    }
  }

  it('keeps selected-child arity checks after accepting all preliminary shapes', () => {
    expect(() => commandArguments('svn clone', [['--m', 'message'], ['-h']], true)).toThrow(
      GitArgumentError,
    );
    expect(() => commandArguments('svn branch', [['--m'], ['-h']], true)).toThrow(GitArgumentError);
    expect(() =>
      commandArguments('svn', [{ operand: 'clone' }, ['--m', 'message'], ['-h']], true),
    ).toThrow(GitArgumentError);
    expect(() => commandArguments('svn', [{ operand: 'branch' }, ['--m'], ['-h']], true)).toThrow(
      GitArgumentError,
    );
    expect(
      commandArguments(
        'svn',
        [{ operand: 'help' }, { operand: 'clone' }, ['--m'], ['--m', 'ignored']],
        true,
      ),
    ).toEqual(['svn', 'help', 'clone', '--m', '--m=ignored']);
  });

  for (const [index, entry] of svnDispatchBoundaries.cases.entries()) {
    it.skipIf(!available)(
      `preserves native command-scan boundary ${index}: ${entry.words.join(' ')}`,
      async () => {
        const root = await mkdtemp(join(tmpdir(), 'type-git-svn-boundary-'));
        const env = {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
          ),
          HOME: root,
          XDG_CONFIG_HOME: root,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: join(root, 'missing'),
          LC_ALL: 'C',
        };
        try {
          expect(spawnSync('git', ['init', '-q', root], { env }).status).toBe(0);
          const native = spawnSync('git', ['svn', ...entry.words], {
            cwd: root,
            env,
            encoding: 'utf8',
            timeout: 10000,
          });
          expect(native.error).toBeUndefined();
          expect(native.signal).toBeNull();
          expect(native.status, native.stderr).toBe(entry.nativeExitCode);
          const repo = await new TypeGit({ inheritEnv: false, env }).open(root);
          if (entry.nativeAccepts) {
            expect(commandArguments('svn', entry.args, true)).toEqual(['svn', ...entry.words]);
            const actual = await repo.command('svn', entry.args as never);
            expect(actual.exitCode).toBe(native.status);
            expect(actual.stdout).toBe(native.stdout);
            expect(actual.stderr).toBe(native.stderr);
          } else {
            try {
              const actual = await repo.command('svn', entry.args as never);
              expect(actual.exitCode).toBe(native.status);
            } catch (error) {
              expect(error).toBeInstanceOf(GitArgumentError);
            }
          }
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      },
    );
  }

  it.skipIf(!available)(
    'selects the first command word across argv before parsing options',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-svn-whole-argv-'));
      const env = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
        ),
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'missing-config'),
        GIT_CONFIG_NOSYSTEM: '1',
        LC_ALL: 'C',
      };
      try {
        expect(spawnSync('git', ['init', '-q', root], { env }).status).toBe(0);
        const cases = [
          {
            args: [
              { operand: 'ignored' },
              { operand: 'fetch' },
              ['--log-window-size', '1'],
              ['-h'],
            ],
            words: ['ignored', 'fetch', '--log-window-size=1', '-h'],
          },
          {
            args: [['-i', 'fetch'], { operand: 'init' }, ['--log-window-size', '1'], ['-h']],
            words: ['-i', 'fetch', 'init', '--log-window-size=1', '-h'],
          },
        ];
        for (const { words } of cases) {
          const native = spawnSync('git', ['svn', ...words], {
            cwd: root,
            env,
            encoding: 'utf8',
            timeout: 10000,
          });
          expect(native.error).toBeUndefined();
          expect(native.signal).toBeNull();
          expect(native.status, native.stderr).toBe(0);
          expect(native.stdout).toContain('Download new revisions from SVN');
          expect(svnDispatch(words, COMMAND_SPECS.svn.dispatch)).toMatchObject({
            kind: 'command',
            command: 'svn fetch',
          });
        }
        const repo = await new TypeGit({ inheritEnv: false, env }).open(root);
        for (const { args, words } of cases) {
          expect(commandArguments('svn', args, true)).toEqual(['svn', ...words]);
          const native = spawnSync('git', ['svn', ...words], {
            cwd: root,
            env,
            encoding: 'utf8',
            timeout: 10000,
          });
          const actual = await repo.command('svn', args as never);
          expect(actual.exitCode).toBe(native.status);
          expect(actual.stdout).toBe(native.stdout);
          expect(actual.stderr).toBe(native.stderr);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('exposes all registered operations and resolves globals after local aliases', () => {
    const names = Object.keys(COMMAND_SPECS).filter((name) => name.startsWith('svn '));
    expect(names).toHaveLength(25);
    for (const name of names) {
      const operation = name.slice(4);
      expect(commandArguments('svn', [{ operand: operation }, ['-h']], true)).toEqual([
        'svn',
        operation,
        '-h',
      ]);
    }
    // Global id|i=s replaces dcommit's interactive|i declaration in GetOptions.
    expect(commandArguments('svn dcommit', [['-i', 'svn-id'], ['--interactive']], true)).toEqual([
      'svn',
      'dcommit',
      '-i',
      'svn-id',
      '--interactive',
    ]);
    expect(() => commandArguments('svn dcommit', [['-i']], true)).toThrow(GitArgumentError);
    expect(() => commandArguments('svn fetch', [['--noMetadata']], true)).toThrow(GitArgumentError);
    expect(() => commandArguments('svn fetch', [['--help']], true)).toThrow(GitArgumentError);
  });
  it('checks required operands without inventing maxima for ignored extra words', () => {
    for (const name of [
      'svn clone',
      'svn branch',
      'svn tag',
      'svn find-rev',
      'svn propget',
      'svn propset',
      'svn commit-diff',
    ] as const) {
      expect(() => commandArguments(name, [], true)).toThrow(GitArgumentError);
    }
    for (const name of [
      'svn clone',
      'svn branch',
      'svn tag',
      'svn find-rev',
      'svn propget',
      'svn propset',
      'svn commit-diff',
    ] as const) {
      expect(
        commandArguments(
          name,
          ['one', 'two', 'three', 'four'].map((operand) => ({ operand })),
          true,
        ),
      ).toEqual([...name.split(' '), 'one', 'two', 'three', 'four']);
    }
    for (const name of ['svn fetch', 'svn info'] as const) {
      expect(() => commandArguments(name, [{ operand: 'one' }, { operand: 'two' }], true)).toThrow(
        GitArgumentError,
      );
    }
    expect(() => commandArguments('svn find-rev', [{ operand: '0' }], true)).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('svn propset', [{ operand: '' }, { operand: '' }], true)).toEqual([
      'svn',
      'propset',
      '',
      '',
    ]);
  });
  it('preserves config-supplied inputs, explicit empty conflicts, and early exits', () => {
    expect(commandArguments('svn init', [], true)).toEqual(['svn', 'init']);
    expect(commandArguments('svn multi-init', [], true)).toEqual(['svn', 'multi-init']);
    expect(commandArguments('svn reset', [], true)).toEqual(['svn', 'reset']);
    expect(commandArguments('svn commit-diff', [{ operand: 'a' }, { operand: 'b' }], true)).toEqual(
      ['svn', 'commit-diff', 'a', 'b'],
    );
    expect(() =>
      commandArguments(
        'svn commit-diff',
        [['-m', ''], ['-F', ''], { operand: 'a' }, { operand: 'b' }],
        true,
      ),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments(
        'svn init',
        [
          ['--rewrite-root', ''],
          ['--rewrite-uuid', ''],
        ],
        true,
      ),
    ).toThrow(GitArgumentError);
    expect(commandArguments('svn clone', [['--version']], true)).toEqual([
      'svn',
      'clone',
      '--version',
    ]);
    expect(
      commandArguments('svn find-rev', [['--before'], ['--after'], { operand: 'r1' }], true),
    ).toEqual(['svn', 'find-rev', '--before', '--after', 'r1']);
    expect(commandArguments('svn log', [{ operand: '--all' }, ['--limit', 2]], true)).toEqual([
      'svn',
      'log',
      '--all',
      '--limit=2',
    ]);
  });
  it.skipIf(!available).each(operations)(
    'matches the native help grammar for %s without SVN transport',
    async (operation) => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-svn-help-'));
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'global'),
        GIT_CONFIG_NOSYSTEM: '1',
      };
      try {
        expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
        const result = spawnSync('git', ['-C', root, 'svn', operation, '-h'], {
          env,
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status, result.stderr).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    30000,
  );
  it.skipIf(!available)(
    'preserves Getopt::Long integer spelling and width before help',
    () => {
      for (const value of [
        '9007199254740992',
        '18446744073709551616',
        '1_000',
        '+2',
        '-2',
        '1\n',
        '',
      ]) {
        const native = spawnSync('git', ['svn', 'clone', `--log-window-size=${value}`, '-h'], {
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(native.error).toBeUndefined();
        expect(native.signal).toBeNull();
        expect(native.status, native.stderr).toBe(0);
        expect(commandArguments('svn clone', [['--log-window-size', value], ['-h']], true)).toEqual(
          ['svn', 'clone', `--log-window-size=${value}`, '-h'],
        );
      }
    },
    30000,
  );
  it.skipIf(!available).each(['0x10', '1x', '١٢', '1\n\n', '1\r\n', '1\u2028', ' '])(
    'rejects the native integer spelling %j before help',
    (value) => {
      const native = spawnSync('git', ['svn', 'clone', `--log-window-size=${value}`, '-h'], {
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      expect(native.signal).toBeNull();
      expect(native.status, native.stderr).toBe(1);
      expect(native.stderr).toContain('invalid for option log-window-size');
      expect(() =>
        commandArguments('svn clone', [['--log-window-size', value], ['-h']], true),
      ).toThrow(GitArgumentError);
    },
  );
  it.skipIf(!available)(
    'matches native local failures and ignored operands without SVN transport',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'type-git-svn-'));
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_GLOBAL: join(root, 'global'),
        GIT_CONFIG_NOSYSTEM: '1',
      };
      const run = (args: string[]) => {
        const result = spawnSync('git', ['-C', root, 'svn', ...args], {
          env,
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).not.toBeNull();
        return result;
      };
      try {
        expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
        expect(run(['fetch', 'one', 'two']).stderr).toContain('usage:');
        expect(run(['branch']).stderr).toContain('name required');
        expect(run(['find-rev']).stderr).toContain('revision required');
        expect(run(['propset']).status).not.toBe(0);
        expect(run(['multi-fetch', 'ignored']).status).toBe(0);
        expect(run(['migrate', 'ignored']).status).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    30000,
  );
  it.skipIf(!localAvailable)(
    'reads metadata from an isolated local SVN repository',
    async () => {
      await withLocalSvn(async ({ url, repo }) => {
        expect((await repo.command('svn info', [])).stdout).toContain(`${url}/trunk`);
        expect((await repo.command('svn find-rev', [{ operand: 'r1' }])).stdout.trim()).toMatch(
          /^[0-9a-f]{40}$/,
        );
        expect((await repo.command('svn log', [['--limit', 1]])).stdout).toContain('fixture');
        expect((await repo.command('svn proplist', [])).stdout).toContain('Properties on');
      });
    },
    60000,
  );
  it.skipIf(!localAvailable)(
    'executes local SVN fetching, housekeeping and rebase operations',
    async () => {
      await withLocalSvn(async ({ repo }) => {
        for (const command of [
          'svn fetch',
          'svn show-ignore',
          'svn show-externals',
          'svn mkdirs',
          'svn create-ignore',
          'svn multi-fetch',
          'svn migrate',
          'svn gc',
        ] as const) {
          expect((await repo.command(command, [])).exitCode).toBe(0);
        }
        await repo.command('svn rebase', [['--local']]);
      });
    },
    60000,
  );
  it.skipIf(!localAvailable)(
    'accepts local dry runs and a configuration-supplied commit-diff revision',
    async () => {
      await withLocalSvn(async ({ url, repo }) => {
        await repo.command('svn dcommit', [['--dry-run']]);
        await repo.command('svn branch', [['--dry-run'], { operand: 'fixture-branch' }]);
        await repo.command('svn tag', [['--dry-run'], { operand: 'fixture-tag' }]);
        await repo.raw(['config', 'svn.revision', 'HEAD']);
        expect(
          (
            await repo.command('svn commit-diff', [
              { operand: 'HEAD' },
              { operand: 'HEAD' },
              { operand: `${url}/trunk` },
            ])
          ).stdout,
        ).toContain('No changes');
      });
    },
    60000,
  );
  it.skipIf(!localAvailable)(
    'accepts a configuration-supplied reset revision and initializes local layouts',
    async () => {
      await withLocalSvn(async ({ root, url, git, repo }) => {
        await repo.raw(['config', 'svn.revision', '1']);
        await repo.command('svn reset', []);
        await git.command('svn init', [
          ['--stdlayout'],
          { operand: url },
          { operand: join(root, 'initialized') },
        ]);
        await git.command('svn multi-init', [
          ['--trunk', 'trunk'],
          { operand: url },
          { operand: join(root, 'multi') },
        ]);
      });
    },
    60000,
  );
});
