import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/stash-create-corpus.json';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { strict } from '../strict/index.js';
import { commandArguments, commandHasLegacyStashHelp } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

/**
 * Git 2.25.1 runs an empty parent parse_options pass over the whole stash argv before it
 * dispatches to create (builtin/stash.c:cmd_stash). That pass stops at the first "--" or
 * "--end-of-options" and exits 129 for help ("-h" followed by anything, "--help",
 * "--help-all") or for the single-dash typo check ("-no-..."). Newer Git selects the
 * create subcommand first, and create joins every later word into the message.
 */
function legacyParentExit(words: readonly string[]): 'help' | 'typo' | null {
  for (const word of words) {
    if (word === '--' || word === '--end-of-options') {
      return null;
    }
    if (word === '--help' || word === '--help-all' || /^-h/.test(word)) {
      return 'help';
    }
    if (/^-no-/.test(word)) {
      return 'typo';
    }
  }
  return null;
}

describe('stash create message words', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-stash-create-'));
    env = {
      PATH: process.env.PATH ?? '',
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_COUNT: '0',
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'initial\n');
    await repo.add('tracked');
    await repo.commit({ message: 'tracked' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
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

  const sequences: readonly (readonly string[])[] = [
    ['message'],
    ['-no-message'],
    ['-h'],
    ['-hx'],
    ['-xh'],
    ['--he'],
    ['--help-all'],
    ['-q', '--unknown', 'message'],
    ['message', '--', '-no-message', '-h'],
    ['--end-of-options', '--help'],
    ['', 'empty', ''],
    ['-no-x', '-h'],
    ['-h', '-no-x'],
    ['-no-'],
    ['-no'],
    ['-hno-x'],
    ['-nh'],
    ['-'],
  ];

  it('matches the selected Git for direct and root-dispatched calls', async () => {
    for (const words of sequences) {
      const operands = words.map((operand) => ({ operand }));
      for (const [command, args] of [
        ['stash create', operands],
        ['stash', [{ operand: 'create' }, ...operands]],
      ] as const) {
        const label = `${command} ${JSON.stringify(words)}`;
        const actual = await strict(repo).command(command, args);
        const native = direct(['stash', 'create', ...words]);
        expect(actual.exitCode, label).toBe(native.status);
        expect(actual.stderr, label).toBe(native.stderr);
        const exit = legacy ? legacyParentExit(words) : null;
        if (exit) {
          expect(actual.exitCode, label).toBe(129);
          if (exit === 'help') {
            expect(actual.stdout, label).toContain('usage: git stash');
          } else {
            expect(actual.stderr, label).toContain('with two dashes');
          }
          continue;
        }
        expect(actual.exitCode, label).toBe(0);
        const oid = actual.stdout.trim();
        expect(oid, label).toMatch(/^[0-9a-f]{40}$/);
        const message = direct(['log', '-1', '--format=%B', oid]).stdout.replace(/\n+$/, '');
        // Words are joined by single spaces; an empty result falls back to "WIP on <branch>".
        const joined = words.join(' ');
        if (joined) {
          expect(message.slice(message.indexOf(': ') + 2), label).toBe(joined);
          expect(message, label).toMatch(/^On [^:]+: /);
        } else {
          expect(message, label).toMatch(/^WIP on /);
        }
      }
    }
  });

  it('leaves the stat-dirty but content-clean exit to native Git', async () => {
    const tracked = join(repo.workdir, 'tracked');
    const results = [];
    // Each run gets its own mtime so the previous run's index refresh cannot match it.
    let mtime = 978307200;
    try {
      for (const run of [
        () => strict(repo).command('stash create', [{ operand: 'msg' }]),
        () => {
          const result = direct(['stash', 'create', 'msg']);
          return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
        },
      ]) {
        await writeFile(tracked, 'initial\n');
        mtime += 86400;
        await utimes(tracked, mtime, mtime);
        results.push(await run());
      }
    } finally {
      await writeFile(tracked, 'changed\n');
    }
    const [actual, native] = results;
    expect(actual?.exitCode).toBe(native?.exitCode);
    expect(actual?.stdout).toBe('');
    expect(native?.stdout).toBe('');
    if (process.platform !== 'win32') {
      // The quick tracked-change check sees the stat change; the refreshed index has none.
      expect(native?.exitCode).toBe(1);
    }
  });

  it('passes a dash-prefixed push message that only the legacy parent rejects', async () => {
    for (const [command, args] of [
      ['stash push', [['-m', '-no-message']]],
      ['stash', [['-m', '-no-message']]],
      ['stash push', [['-m', '-h']]],
      ['stash', [['-m', '-h']]],
    ] as const) {
      const label = `${command} ${JSON.stringify(args)}`;
      const actual = await strict(repo).command(command, args);
      const message = args[0][1];
      if (legacy) {
        expect(actual.exitCode, label).toBe(129);
        if (message === '-h') {
          expect(actual.stdout, label).toContain('usage: git stash');
        } else {
          expect(actual.stderr, label).toContain('with two dashes');
        }
        await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
        continue;
      }
      expect(actual.exitCode, label).toBe(0);
      expect(direct(['log', '-1', '--format=%s', 'refs/stash']).stdout, label).toMatch(
        new RegExp(`^On [^:]+: ${message}\\n$`),
      );
      expect(direct(['stash', 'pop', '-q']).status, label).toBe(0);
    }
  });

  it('does not refuse a modern create message because of the legacy parent typo check', () => {
    expect(commandHasLegacyStashHelp('stash create', [{ operand: '-no-message' }])).toBe(false);
    expect(commandHasLegacyStashHelp('stash create', [{ operand: '-hx' }])).toBe(true);
    expect(commandArguments('stash create', [{ operand: '-no-message' }])).toEqual([
      'stash',
      'create',
      '-no-message',
    ]);
  });

  it('still refuses a single-dash typo where the modern child parses options', () => {
    for (const command of ['stash apply', 'stash drop', 'stash pop', 'stash save'] as const) {
      expect(() => commandArguments(command, [{ operand: '-no-x' }]), command).toThrow(
        GitArgumentError,
      );
    }
  });

  it('refuses option, separator and NUL tokens that have no create grammar', () => {
    expect(() => commandArguments('stash create', [['--']])).toThrow(GitArgumentError);
    expect(() => commandArguments('stash create', [['-h'] as never])).toThrow(GitArgumentError);
    expect(() => commandArguments('stash create', [{ operand: 'a\0b' }])).toThrow(GitArgumentError);
  });
});

describe('native stash create corpus', () => {
  it('accepts every Git 2.55.0 message word and serializes it unchanged', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let argv: string[] | null = null;
      try {
        argv = commandArguments(row.command as GitCommandName, row.tokens, true);
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
      }
      if ((argv !== null) !== row.valid) {
        mismatches.push(`${row.state} ${JSON.stringify(row.argv)}: native=${row.valid}`);
      } else if (argv) {
        expect(argv, JSON.stringify(row.argv)).toEqual(row.argv);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
