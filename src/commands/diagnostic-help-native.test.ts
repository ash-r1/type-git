import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const unknownCommand: RegExp = /not a git command/;
const invalidMode: RegExp = /invalid --(?:mode|diagnose) value/;
const unknownOption: RegExp = /unknown option/;

for (const [command, mode] of [
  ['bugreport', '--diagnose'],
  ['diagnose', '--mode'],
] as const) {
  describe(`native ${command} help and diagnostic callback`, () => {
    let root: string;
    let repo: WorktreeRepo;
    let env: Record<string, string>;
    let supported: boolean;
    const native = (words: string[]): SpawnSyncReturns<string> => {
      const result = spawnSync('git', ['-C', repo.workdir, command, ...words], {
        env,
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      return result;
    };
    /** Detect any diagnostic report, archive, or repository write during help controls. */
    const snapshot = async (): Promise<Record<string, string>> => {
      const files: Record<string, string> = {};
      /** Hash every fixture file without relying on filesystem traversal order. */
      const walk = async (dir: string): Promise<void> => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(path);
          } else if (entry.isFile()) {
            files[relative(root, path)] = createHash('sha256')
              .update(await readFile(path))
              .digest('hex');
          }
        }
      };
      await walk(root);
      return files;
    };
    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), `type-git-${command}-help-`));
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
      supported = !unknownCommand.test(native(['-h']).stderr);
    });
    afterAll(async () => {
      await rm(root, { recursive: true, force: true });
    });
    it('matches ordered errors, ignored tails and completion without writing reports', async (context) => {
      if (!supported) {
        context.skip();
        return;
      }
      const before = await snapshot();
      const parity = async (args: readonly unknown[], words: string[]): Promise<void> => {
        const expected = native(words);
        const actual = await repo.command(command, args as never, { stdin: '' });
        expect(actual.exitCode).toBe(expected.status);
        expect(actual.stdout).toBe(expected.stdout);
        expect(actual.stderr).toBe(expected.stderr);
      };
      for (const help of ['-h', '--help-all']) {
        for (const value of ['stats', 'all', '', 'STATS', 'bad', 'none', 'stats,all', 'é']) {
          await parity([[help], [mode, value]], [help, `${mode}=${value}`]);
          const expected = native([`${mode}=${value}`, help]);
          if (invalidMode.test(expected.stderr)) {
            await expect(
              repo.command(command, [[mode, value], [help]] as never),
            ).rejects.toBeInstanceOf(GitArgumentError);
          } else {
            await parity([[mode, value], [help]], [`${mode}=${value}`, help]);
          }
        }
        await parity([[help], ['--type-git-unknown-tail']], [help, '--type-git-unknown-tail']);
        await parity([{ operand: 'ignored' }, [help]], ['ignored', help]);
        await parity(
          [[mode, 'stats'], [help], [mode, 'invalid']],
          [`${mode}=stats`, help, `${mode}=invalid`],
        );
      }
      for (const helper of ['--git-completion-helper', '--git-completion-helper-all']) {
        const expected = native([helper]);
        expect(expected.status).toBe(0);
        await parity([[helper]], [helper]);
        expect(native([helper, '-h']).stderr).toMatch(unknownOption);
        await expect(repo.command(command, [[helper], ['-h']] as never)).rejects.toBeInstanceOf(
          GitArgumentError,
        );
        await parity([['-h'], [helper]], ['-h', helper]);
      }
      await parity(
        [[mode, 'stats'], ['--help'], [mode, 'invalid']],
        [`${mode}=stats`, '--help', `${mode}=invalid`],
      );
      expect(await snapshot()).toEqual(before);
    });
  });
}
