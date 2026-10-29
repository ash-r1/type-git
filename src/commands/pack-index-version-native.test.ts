import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const parserError: RegExp = /bad .*index.version|unsupported index version/;

describe('native pack index version parsers', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-pack-index-version-'));
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
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('matches selected native acceptance before usage without writing a pack', async () => {
    for (const command of ['pack-objects', 'index-pack'] as const) {
      for (const value of [
        '',
        '0',
        '1',
        '2',
        '3',
        'bad',
        '1k',
        '1,',
        ',',
        ',1',
        '+1',
        '-1',
        ' 1',
        '1 ',
        '4294967296',
        '4294967298',
        '1,0x10',
        '1,010',
        '1,08',
        '1,0b10',
        '1,-1',
        '1,-4294967296',
        '1,2147483648',
        '1,4294967296',
        '1,-18446744073709551616',
      ]) {
        for (const helpFirst of [false, true]) {
          const words = helpFirst
            ? ['-h', `--index-version=${value}`]
            : [`--index-version=${value}`, '-h'];
          const native = spawnSync('git', ['-C', repo.workdir, command, ...words], {
            env,
            input: '',
            encoding: 'utf8',
            timeout: 30_000,
          });
          expect(native.error).toBeUndefined();
          expect(native.signal).toBeNull();
          const args = helpFirst
            ? [['-h'], ['--index-version', value]]
            : [['--index-version', value], ['-h']];
          if (parserError.test(native.stderr)) {
            await expect(
              repo.command(command, args as never, { stdin: '' }),
            ).rejects.toBeInstanceOf(GitArgumentError);
          } else {
            const actual = await repo.command(command, args as never, { stdin: '' });
            expect(actual.exitCode, `${command} ${value}`).toBe(native.status);
            expect(actual.stdout).toBe(native.stdout);
            expect(actual.stderr).toBe(native.stderr);
          }
        }
      }
    }
  });
});
