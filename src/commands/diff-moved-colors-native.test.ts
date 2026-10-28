import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

describe('native moved-color callback grammars and help placement', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-moved-colors-'));
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
    const unknown = '--type-git-invalid-diff-moved-colors-usage-profile';
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

  it('matches ordinary no-change diff resets, diagnostics and selected boolean families', async () => {
    const before = await snapshot();
    for (const [flag, values] of [
      ['--color-moved', ['k', '-2147483648', '0b1']],
      [
        '--color-moved-ws',
        [
          'unknown,no',
          'no,,no',
          'é,no',
          'no,unknown',
          'no,',
          'ignore-all-space,allow-indentation-change',
        ],
      ],
    ] as const) {
      for (const value of values) {
        const expected = native(['diff', `${flag}=${value}`]);
        const execute = async () => repo.command('diff', [[flag, value]] as never, { stdin: '' });
        if (expected.status === 0) {
          const actual = await execute();
          expect(actual.exitCode).toBe(0);
          expect(actual.stdout).toBe(expected.stdout);
          expect(actual.stderr).toBe(expected.stderr);
        } else {
          expect(expected.status).toBe(129);
          await expect(execute()).rejects.toThrow();
        }
        expect(await snapshot()).toEqual(before);
      }
    }
  });

  for (const command of [...continuing, ...streaming, ...deferred]) {
    it.skipIf(!builtins.has(command.split(' ')[0] ?? ''))(
      `${command}: native moved-color grammars and help phases`,
      async () => {
        const before = await snapshot();
        const cases = [
          ...[undefined, '', 'YES', '1k', 'plain', 'dimmed_zebra'].map((value) => ({
            flag: '--color-moved',
            value,
            invalid: false,
          })),
          ...['PLAIN', 'unknown', '2147483648'].map((value) => ({
            flag: '--color-moved',
            value,
            invalid: true,
          })),
          ...[
            'no',
            'unknown,no',
            'no,,no',
            'é,no',
            'ignore-all-space,no,allow-indentation-change',
          ].map((value) => ({ flag: '--color-moved-ws', value, invalid: false })),
          ...['', 'NO', 'no,unknown', 'no,', 'ignore-all-space,allow-indentation-change'].map(
            (value) => ({ flag: '--color-moved-ws', value, invalid: true }),
          ),
          { flag: '--no-color-moved', value: undefined, invalid: false },
          { flag: '--no-color-moved-ws', value: undefined, invalid: false },
        ];
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
                    row.flag === '--color-moved' ? 'bad --color-moved argument' : 'invalid mode',
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
