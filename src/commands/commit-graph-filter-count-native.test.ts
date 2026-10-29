import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const unavailableOption: RegExp = /unknown option.*max-new-filters/;

describe('native commit-graph filter count callback', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  let registered: boolean;
  const native = (words: string[]): SpawnSyncReturns<string> => {
    const result = spawnSync('git', ['-C', root, 'commit-graph', 'write', ...words], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  const snapshot = async (): Promise<Record<string, string>> => {
    const files: Record<string, string> = {};
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(path);
        } else if (entry.isFile()) {
          files[relative(root, path)] = (await readFile(path)).toString('hex');
        }
      }
    };
    await walk(root);
    return files;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-graph-filter-count-'));
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && !entry[0].toUpperCase().startsWith('GIT_'),
        ),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'none'),
      LC_ALL: 'C',
    };
    repo = await new TypeGit({ inheritEnv: false, env }).init(root);
    const help = native(['-h']);
    registered = (help.stdout + help.stderr).includes('max-new-filters');
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);
  const compare = async (
    args: readonly unknown[],
    words: string[],
  ): Promise<SpawnSyncReturns<string>> => {
    const expected = native(words);
    const actual = await repo.command('commit-graph write', args as never, { stdin: '' });
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
    return expected;
  };
  it('compares accepted decimal strings and distinguishes unavailable native options', async () => {
    const before = await snapshot();
    for (const value of [
      '',
      '0',
      '-1',
      '+1',
      ' 1',
      '2147483648',
      '4294967296',
      '99999999999999999999999999999',
    ]) {
      const result = await compare(
        [['--max-new-filters', value], ['-h']],
        [`--max-new-filters=${value}`, '-h'],
      );
      if (registered) {
        expect([0, 129]).toContain(result.status);
        expect(result.stderr).not.toContain('expects a numerical value');
      } else {
        expect(result.status).toBe(129);
        expect(result.stderr).toMatch(unavailableOption);
      }
    }
    for (const value of ['bad', '1k', '1\n', '0x10']) {
      for (const flag of ['-h', '--help', '--help-all']) {
        const help = await compare(
          [[flag], ['--max-new-filters', value]],
          [flag, `--max-new-filters=${value}`],
        );
        expect([0, 129]).toContain(help.status);
        expect(help.stdout + help.stderr).toContain('usage:');
        if (registered) {
          const expected = native([`--max-new-filters=${value}`, flag]);
          expect(expected.status).toBe(129);
          expect(expected.stderr).toContain('expects a numerical value');
          await expect(
            repo.command('commit-graph write', [['--max-new-filters', value], [flag]] as never),
          ).rejects.toBeInstanceOf(GitArgumentError);
        }
      }
    }
    if (registered) {
      expect(
        (await compare([['--no-max-new-filters'], ['-h']], ['--no-max-new-filters', '-h'])).stderr,
      ).not.toContain('error:');
    }
    expect(await snapshot()).toEqual(before);
  }, 120_000);
});
