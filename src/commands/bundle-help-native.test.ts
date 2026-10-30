import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const unknownOption: RegExp = /unknown option/;

for (const subcommand of ['create', 'verify', 'list-heads', 'unbundle'] as const) {
  const command = `bundle ${subcommand}` as const;
  describe(`native ${command} stopped option parser`, () => {
    let root: string;
    let repo: WorktreeRepo;
    let env: Record<string, string>;
    const native = (words: string[]): SpawnSyncReturns<string> => {
      const result = spawnSync('git', ['-C', repo.workdir, 'bundle', subcommand, ...words], {
        env,
        input: '',
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      return result;
    };
    /** Detect a bundle output or repository write during help and parser-stop controls. */
    const snapshot = async (): Promise<Record<string, string>> => {
      const files: Record<string, string> = {};
      /** Hash the entire isolated fixture independently of filesystem traversal order. */
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
    const parity = async (args: readonly unknown[], words: string[]): Promise<void> => {
      const expected = native(words);
      const actual = await repo.command(command, args as never, { stdin: '' });
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
    };
    beforeAll(async () => {
      root = await mkdtemp(join(tmpdir(), `type-git-bundle-${subcommand}-help-`));
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
    it('matches reached help and completion while retaining native exit status and output', async () => {
      const before = await snapshot();
      for (const help of ['-h', '--help', '--help-all']) {
        await parity([[help], ['--type-git-ignored-tail']], [help, '--type-git-ignored-tail']);
        await parity([[help], { operand: 'missing.bundle' }], [help, 'missing.bundle']);
        expect(native(['--type-git-unknown-prefix', help]).stderr).toMatch(unknownOption);
        await expect(
          repo.command(command, [['--type-git-unknown-prefix'], [help]] as never),
        ).rejects.toBeInstanceOf(GitArgumentError);
        if (subcommand === 'create') {
          await parity([[help], ['--version', 'invalid']], [help, '--version=invalid']);
          await parity([['--version', 4], [help]], ['--version=4', help]);
          expect(native(['--version=invalid', help]).status).not.toBe(0);
          await expect(
            repo.command(command, [['--version', 'invalid'], [help]] as never),
          ).rejects.toBeInstanceOf(GitArgumentError);
        }
      }
      for (const helper of ['--git-completion-helper', '--git-completion-helper-all']) {
        const expected = native([helper]);
        if (unknownOption.test(expected.stderr)) {
          // Older selected Git can lack a helper spelling; retain that native error.
          expect(expected.status).not.toBe(0);
        } else {
          expect(expected.status).toBe(0);
        }
        await parity([[helper]], [helper]);
        expect(native([helper, '-h']).stderr).toMatch(unknownOption);
        await expect(repo.command(command, [[helper], ['-h']] as never)).rejects.toBeInstanceOf(
          GitArgumentError,
        );
        await parity([['-h'], [helper]], ['-h', helper]);
      }
      expect(await snapshot()).toEqual(before);
    });
    it('retains file and separator boundaries rather than treating later words as options', async () => {
      const before = await snapshot();
      await parity([{ operand: 'missing.bundle' }, { operand: '-h' }], ['missing.bundle', '-h']);
      await expect(
        repo.command(command, [{ operand: 'missing.bundle' }, ['-h']] as never),
      ).rejects.toBeInstanceOf(GitArgumentError);
      await parity(
        [['--'], { operand: 'missing.bundle' }, { operand: '-h' }],
        ['--', 'missing.bundle', '-h'],
      );
      expect(await snapshot()).toEqual(before);
    });
  });
}
