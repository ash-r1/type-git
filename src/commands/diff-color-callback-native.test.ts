import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { commandArguments } from './build.js';

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
  throw builtinList.error ?? new Error(`Cannot enumerate native builtins: ${builtinList.stderr}`);
}
const builtins = new Set(builtinList.stdout.split(/\s+/));
const continuing = ['diff', 'diff-files', 'diff-index', 'diff-tree', 'rev-list'] as const;
const streaming = ['diff --no-index', 'range-diff', 'diff-pairs'] as const;
const deferred = ['backfill', 'last-modified', 'replay'] as const;

describe('native diff color callback order', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (words: string[]) => {
    const result = spawnSync('git', ['-C', root, ...words], {
      env,
      encoding: 'utf8',
      input: '',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  const snapshot = () =>
    Promise.all([
      readdir(root).then((entries) => entries.sort()),
      ...['file', '.git/index', '.git/HEAD', '.git/config'].map((path) =>
        readFile(join(root, path)),
      ),
    ]);
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-diff-color-'));
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
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  for (const command of [...continuing, ...streaming, ...deferred]) {
    it.skipIf(!builtins.has(command.split(' ')[0] ?? ''))(
      `${command}: callback and help placement`,
      async () => {
        const before = await snapshot();
        for (const help of ['-h', '--help-all']) {
          for (const value of ['always', 'AuTo', 'invalid']) {
            for (const colorFirst of [true, false]) {
              const args = colorFirst ? [['--color', value], [help]] : [[help], ['--color', value]];
              const words = colorFirst ? [`--color=${value}`, help] : [help, `--color=${value}`];
              const expected = native([...command.split(' '), ...words]);
              const rejects =
                ((continuing as readonly string[]).includes(command) && help === '--help-all') ||
                (value === 'invalid' &&
                  ((continuing as readonly string[]).includes(command) ||
                    ((streaming as readonly string[]).includes(command) && colorFirst)));
              if (rejects) {
                expect(expected.status).not.toBe(0);
                if (help === '-h') {
                  expect(expected.stderr).toMatch(/color/i);
                } else {
                  expect(expected.stderr.length).toBeGreaterThan(0);
                }
                expect(() => commandArguments(command, args)).toThrow();
              } else {
                const actual = await repo.command(command, args as never, { stdin: '' });
                expect(actual.exitCode).toBe(expected.status);
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
