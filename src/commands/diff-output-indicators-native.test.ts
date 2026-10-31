import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { commandArguments } from './build.js';

const continuing = ['diff', 'diff-files', 'diff-index', 'diff-tree', 'rev-list'] as const;
const streaming = [
  'diff --no-index',
  'range-diff',
  'diff-pairs',
  'blame',
  'annotate',
  'pickaxe',
  'shortlog',
] as const;
const deferred = [
  'log',
  'show',
  'reflog show',
  'stash show',
  'cherry-pick',
  'revert',
  'backfill',
  'last-modified',
  'replay',
  'format-patch',
  'whatchanged',
  'fast-export',
  'difftool',
  'reflog',
  'stash list',
] as const;
const indicatorFlags = [
  '--output-indicator-new',
  '--output-indicator-old',
  '--output-indicator-context',
] as const;
const cleanEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
  ),
);
const builtinList = spawnSync('git', ['--list-cmds=builtins'], {
  env: cleanEnvironment,
  encoding: 'utf8',
  input: '',
  timeout: 30_000,
});
if (builtinList.error || builtinList.status !== 0) {
  throw (
    builtinList.error ?? new Error(`Cannot enumerate selected native Git: ${builtinList.stderr}`)
  );
}
const builtins = new Set(builtinList.stdout.split(/\s+/));

describe('native diff indicator callback grammar and help placement', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  let diffUsageExit: 129 | 255;
  let difftoolFullHelpSignal: NodeJS.Signals | null = null;
  const native = (words: string[], expectedSignal: NodeJS.Signals | null = null) => {
    const result = spawnSync('git', ['-C', root, ...words], {
      env,
      encoding: 'utf8',
      input: '',
      timeout: 30_000,
    });
    expect(result.error, JSON.stringify(words)).toBeUndefined();
    expect(result.signal, JSON.stringify(words)).toBe(expectedSignal);
    return result;
  };
  const snapshot = () =>
    Promise.all([
      readdir(root).then((entries) => entries.sort()),
      readdir(join(root, '.git')).then((entries) => entries.sort()),
      ...['file', '.git/index', '.git/HEAD', '.git/config'].map((path) =>
        readFile(join(root, path)),
      ),
    ]);
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-stat-callback-'));
    env = {
      ...cleanEnvironment,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      LC_ALL: 'C',
      GIT_PAGER: 'fixture-pager',
      GIT_EDITOR: 'fixture-editor',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const words of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(words).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
    const before = await snapshot();
    const unknown = '--type-git-invalid-diff-output-indicators-usage-profile';
    const result = native(['diff', unknown]);
    expect(result.stderr).toContain(`error: invalid option: ${unknown}`);
    if (result.status !== 129 && result.status !== 255) {
      throw new Error(`Unsupported diff usage exit: ${result.status}`);
    }
    diffUsageExit = result.status;
    if (builtins.has('difftool')) {
      // Old parse-options full help dereferences difftool's hidden NULL help text.
      // Measure that independent invocation and preserve native signal propagation.
      const fullHelp = spawnSync('git', ['-C', root, 'difftool', '--help-all'], {
        env,
        encoding: 'utf8',
        input: '',
        timeout: 30_000,
      });
      expect(fullHelp.error).toBeUndefined();
      if (fullHelp.signal !== null) {
        expect(fullHelp.signal).toBe('SIGSEGV');
        expect(fullHelp.status).toBeNull();
        difftoolFullHelpSignal = fullHelp.signal;
      } else {
        expect([0, 129]).toContain(fullHelp.status);
      }
    }
    expect(await snapshot()).toEqual(before);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  for (const command of [...continuing, ...streaming, ...deferred]) {
    it.skipIf(!builtins.has(command.split(' ')[0] ?? ''))(
      `${command}: native diff indicator grammar and help phases`,
      async () => {
        const before = await snapshot();
        const cases = indicatorFlags.flatMap((flag) => [
          { flag, value: '+', invalid: false },
          { flag, value: ' ', invalid: false },
          { flag, value: '\n', invalid: false },
          { flag, value: 'ab', invalid: true },
          { flag, value: 'é', invalid: true },
          { flag, value: '😀', invalid: true },
        ]);
        for (const help of ['-h', '--help-all']) {
          for (const row of cases) {
            for (const afterHelp of [false, true]) {
              const option = row.value === undefined ? [row.flag] : [row.flag, row.value];
              const token = row.value === undefined ? row.flag : `${row.flag}=${row.value}`;
              const args = afterHelp ? [[help], option] : [option, [help]];
              const words = afterHelp ? [help, token] : [token, help];
              const expectedSignal =
                command === 'difftool' && help === '--help-all' ? difftoolFullHelpSignal : null;
              const expected = native([...command.split(' '), ...words], expectedSignal);
              const callbackReached =
                (continuing as readonly string[]).includes(command) ||
                ((streaming as readonly string[]).includes(command) && !afterHelp);
              const callbackRejects = callbackReached && row.invalid;
              const usageRejects =
                (continuing as readonly string[]).includes(command) && help === '--help-all';
              if (callbackRejects || usageRejects) {
                expect(expected.status).toBe(
                  callbackRejects ? 129 : command === 'diff' ? diffUsageExit : 129,
                );
                if (callbackRejects) {
                  expect(expected.stderr).toContain(
                    `${row.flag.slice(2)} expects a character, got '${row.value}'`,
                  );
                } else if (command === 'diff') {
                  expect(expected.stderr).toContain('error: invalid option: --help-all');
                } else {
                  expect(expected.stderr).toContain(`usage: git ${command} `);
                }
                expect(() => commandArguments(command, args)).toThrow();
              } else {
                const actual = await repo.command(command, args as never, { stdin: '' });
                expect(actual.exitCode).toBe(expected.status ?? -1);
                expect(actual.signal ?? null).toBe(expected.signal);
                expect(actual.stdout).toBe(expected.stdout);
                expect(actual.stderr).toBe(expected.stderr);
              }
              expect(await snapshot()).toEqual(before);
            }
          }
        }
      },
      120_000,
    );
  }
});
