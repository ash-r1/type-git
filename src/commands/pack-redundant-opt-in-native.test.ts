import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeExecAdapter, NodeFsAdapter, TypeGit } from '../adapters/node/index.js';
import { createGitSync } from '../impl/git-impl.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';

const objectSnapshot = async (directory: string): Promise<Record<string, string>> => {
  const hashes: Record<string, string> = {};
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), `${relative}/`);
      } else {
        hashes[relative] = createHash('sha256')
          .update(await readFile(join(dir, entry.name)))
          .digest('hex');
      }
    }
  };
  await walk(directory, '');
  return hashes;
};

describe('selected-native pack-redundant opt-in controls', () => {
  let root: string;
  let repo: WorktreeRepo;
  let packFiles: string[];
  let env: Record<string, string>;
  const native = (args: string[], input = '') => {
    const result = spawnSync('git', ['-C', root, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return result;
  };
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-pack-redundant-help-'));
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
      GIT_EDITOR: 'fixture-editor',
      GIT_PAGER: 'fixture-pager',
      GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
      GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
    };
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'Fixture'],
      ['config', 'user.email', 'fixture@example.invalid'],
      ['config', 'pack.writeReverseIndex', 'false'],
    ]) {
      expect(native(args).status).toBe(0);
    }
    await writeFile(join(root, 'file'), 'base\n');
    await writeFile(join(root, '--help'), 'base\n');
    expect(native(['add', '--', 'file', '--help']).status).toBe(0);
    expect(native(['commit', '-qm', 'base']).status).toBe(0);
    const full = native(['pack-objects', '--all', '.git/objects/pack/pack']);
    expect(full.status).toBe(0);
    const blob = native(['rev-parse', 'HEAD:file']).stdout.trim();
    const subset = native(['pack-objects', '.git/objects/pack/pack'], `${blob}\n`);
    expect(subset.status).toBe(0);
    const hashes = [full.stdout.trim(), subset.stdout.trim()];
    expect(hashes[0]).not.toBe(hashes[1]);
    for (const hash of hashes) {
      expect(hash).toMatch(/^[0-9a-f]{40}$/);
    }
    packFiles = hashes.map((hash) => `.git/objects/pack/pack-${hash}.pack`);
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).open(root);
  }, 120_000);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  }, 120_000);

  const compare = async (
    args: readonly unknown[],
    words: string[],
    input: string | Uint8Array = '',
    outside = false,
  ) => {
    const snapshot = () =>
      Promise.all([
        readdir(root).then((entries) => entries.sort()),
        objectSnapshot(join(root, '.git', 'objects')),
        ...['.git/index', 'file', '.git/HEAD', '.git/config'].map((path) =>
          readFile(join(root, path)),
        ),
      ]);
    const before = await snapshot();
    const cwd = outside ? await mkdtemp(join(tmpdir(), 'type-git-pack-redundant-outside-')) : root;
    try {
      const expected = spawnSync('git', ['-C', cwd, 'pack-redundant', ...words], {
        env,
        input,
        encoding: 'utf8',
        timeout: 30_000,
      });
      expect(expected.error).toBeUndefined();
      expect(expected.signal).toBeNull();
      expect(await snapshot()).toEqual(before);
      const exec = new NodeExecAdapter();
      const spawn = exec.spawn.bind(exec);
      exec.spawn = (options) => spawn({ ...options, cwd });
      const git = outside
        ? new TypeGit(
            createGitSync({
              adapters: { exec, fs: new NodeFsAdapter() },
              home: root,
              inheritEnv: false,
              env,
            }),
          )
        : repo;
      const actual = await git.command('pack-redundant', args as never, { stdin: input });
      expect(await snapshot()).toEqual(before);
      expect(actual.exitCode).toBe(expected.status);
      expect(actual.stdout).toBe(expected.stdout);
      expect(actual.stderr).toBe(expected.stderr);
      return expected;
    } finally {
      if (outside) {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  };
  it('preserves selected-native all-mode success or deprecation without writing packs', async () => {
    let successfulInsideControls = 0;
    for (const outside of [false, true]) {
      for (const optIn of [false, true]) {
        for (const tail of [[], ['--verbose'], ['--alt-odb'], ['ignored']]) {
          const words = [...(optIn ? ['--i-still-use-this'] : []), '--all', ...tail];
          const args = [
            ...(optIn ? [['--i-still-use-this']] : []),
            ['--all'],
            ...tail.map((word) => (word.startsWith('--') ? [word] : { operand: word })),
          ];
          const result = await compare(args, words, '', outside);
          if (!outside && result.status === 0) {
            successfulInsideControls++;
            expect(result.stdout).toContain(packFiles[1]);
          }
        }
      }
    }
    expect(successfulInsideControls).toBeGreaterThan(0);
  });
  it('preserves selected-native explicit relative pack-list outcomes', async () => {
    for (const outside of [false, true]) {
      for (const optIn of [false, true]) {
        const words = [...(optIn ? ['--i-still-use-this'] : []), ...packFiles];
        const args = [
          ...(optIn ? [['--i-still-use-this']] : []),
          ...packFiles.map((operand) => ({ operand })),
        ];
        await compare(args, words, '', outside);
      }
    }
  });
  it('preserves sole full usage status and streams inside and outside a repository', async () => {
    for (const outside of [false, true]) {
      const result = await compare([['--help-all']], ['--help-all'], '', outside);
      if (!outside) {
        expect([0, 129]).toContain(result.status);
        expect(result.stdout + result.stderr).toContain('usage: git pack-redundant');
      }
    }
  });
  it('retains missing pack/all input validation', async () => {
    await expect(repo.command('pack-redundant', [] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      repo.command('pack-redundant', [['--i-still-use-this']] as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});
