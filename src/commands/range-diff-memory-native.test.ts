import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const unknownMemory: RegExp = /unknown option.*max-memory/;

describe('native range-diff maximum memory callback', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  let registered: boolean;
  const native = (words: string[]) => {
    const result = spawnSync('git', ['-C', repo.workdir, 'range-diff', ...words], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-range-memory-'));
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
    repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
    registered = !unknownMemory.test(native(['--max-memory=0', '-h']).stderr);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  it('matches native reached errors, ignored tails and supported-version controls', async () => {
    for (const value of [
      '',
      '0',
      '1',
      '-1',
      '+1',
      ' 1',
      '1k',
      '1K',
      '1g',
      '0x10',
      '010',
      '08',
      '0b10',
      '4294967296',
      '18446744073709551615',
      '18446744073709551616',
      'bad',
      '1GB',
      '1.0',
      '1\n',
      '+',
      '١',
    ]) {
      for (const help of ['-h', '--help-all']) {
        for (const first of [false, true]) {
          const expected = native(
            first ? [help, `--max-memory=${value}`] : [`--max-memory=${value}`, help],
          );
          if (!registered && !first) {
            expect(expected.stderr).toMatch(unknownMemory);
            continue;
          }
          const args = first
            ? [[help], ['--max-memory', value]]
            : [['--max-memory', value], [help]];
          if (expected.stderr.includes('invalid max-memory value')) {
            await expect(repo.command('range-diff', args as never)).rejects.toBeInstanceOf(
              GitArgumentError,
            );
          } else {
            const actual = await repo.command('range-diff', args as never);
            expect(actual.exitCode).toBe(expected.status);
            expect(actual.stdout).toBe(expected.stdout);
            expect(actual.stderr).toBe(expected.stderr);
          }
        }
      }
    }
    for (const help of ['-h', '--help-all']) {
      const expected = native([help, '--type-git-unknown-tail', 'raw']);
      const actual = await repo.command('range-diff', [
        [help],
        ['--type-git-unknown-tail', 'raw'],
      ] as never);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    }
    const expected = native(['--no-max-memory', '-h']);
    const actual = await repo.command('range-diff', [['--no-max-memory'], ['-h']]);
    expect(actual.exitCode).toBe(expected.status);
    expect(actual.stdout).toBe(expected.stdout);
    expect(actual.stderr).toBe(expected.stderr);
  });
});
