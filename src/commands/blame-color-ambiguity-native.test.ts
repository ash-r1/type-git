import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import type { RawResult } from '../core/types.js';

describe('native blame color ambiguity', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  const native = (args: string[]) => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    return result;
  };
  const snapshot = () =>
    Promise.all([
      readdir(root).then((entries) => entries.sort()),
      ...['.git/index', '.git/HEAD', '.git/config', 'file'].map((file) =>
        readFile(join(root, file)),
      ),
    ]);
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-blame-color-'));
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
      LC_ALL: 'C',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'fixture\n');
    expect(native(['add', 'file']).status).toBe(0);
    expect(native(['commit', '-qm', 'fixture']).status).toBe(0);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
    it(`${command}: rejects reached ambiguity and preserves ignored tails`, async () => {
      // Exercise runtime rejection even for inputs that the literal API type rejects.
      const invoke = repo.command.bind(repo) as unknown as (
        commandName: string,
        args: readonly unknown[],
      ) => Promise<RawResult>;
      const before = await snapshot();
      const options: readonly (readonly [string, string?])[] = [
        ['--color'],
        ['--color', 'always'],
        ['--color', 'invalid'],
        ['--color-lines'],
      ];
      for (const option of options) {
        for (const afterHelp of [false, true]) {
          const args: readonly (readonly [string, string?])[] = afterHelp
            ? [['-h'], option]
            : [option, ['-h']];
          const words = args.map(([flag, value]) =>
            value === undefined ? flag : `${flag}=${value}`,
          );
          const expected = native([command, ...words]);
          if (!afterHelp && option[0] === '--color') {
            expect(expected.status).toBe(129);
            expect(expected.stderr).toContain('ambiguous option: color');
            await expect(invoke(command, args)).rejects.toThrow('ambiguous');
          } else {
            const actual = await invoke(command, args);
            expect({
              exitCode: actual.exitCode,
              stdout: actual.stdout,
              stderr: actual.stderr,
            }).toEqual({
              exitCode: expected.status,
              stdout: expected.stdout,
              stderr: expected.stderr,
            });
          }
          expect(await snapshot()).toEqual(before);
        }
      }
    }, 120_000);
    it(`${command}: preserves an ordinary unambiguous blame request`, async () => {
      const before = await snapshot();
      const expected = native([command, '--color-lines', '--', 'file']);
      expect(expected.status).toBe(0);
      const actual = await repo.command(command, [['--color-lines'], ['--'], { operand: 'file' }]);
      expect({ exitCode: actual.exitCode, stdout: actual.stdout, stderr: actual.stderr }).toEqual({
        exitCode: expected.status,
        stdout: expected.stdout,
        stderr: expected.stderr,
      });
      expect(await snapshot()).toEqual(before);
    }, 120_000);
  }
});
