import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { WorktreeRepoImpl } from './worktree-repo-impl.js';

function fixture(stdout = '') {
  const adapters = createNodeAdapters();
  const spawn = vi
    .spyOn(adapters.exec, 'spawn')
    .mockResolvedValue({ stdout, stderr: '', exitCode: 0, aborted: false });
  return { repo: new WorktreeRepoImpl(new CliRunner(adapters), '/repo'), spawn };
}

describe('LFS option serialization and output contracts', () => {
  it('forwards conflict stages and destinations', async () => {
    const { repo, spawn } = fixture();
    await repo.lfs.checkout('file.bin', { theirs: true, to: 'theirs.bin' });
    expect(spawn.mock.calls[0]![0].argv).toEqual(
      expect.arrayContaining(['lfs', 'checkout', '--theirs', '--to', 'theirs.bin', 'file.bin']),
    );
    await expect(repo.lfs.checkout('file.bin', { ours: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      repo.lfs.checkout(['a', 'b'], { ours: true, to: 'out' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('forwards verify and preserves verified ownership including absent owners', async () => {
    const { repo, spawn } = fixture(
      JSON.stringify({
        ours: [
          {
            id: '1',
            path: 'a', // biome-ignore lint/style/useNamingConvention: upstream JSON key
            locked_at: '2025-01-01T00:00:00Z',
          },
        ],
        theirs: [
          {
            id: '2',
            path: 'b',
            owner: { name: 'Owner' },
            // biome-ignore lint/style/useNamingConvention: upstream JSON key
            locked_at: '2025-01-02T00:00:00Z',
          },
        ],
      }),
    );
    const locks = await repo.lfs.locks({ verify: true, cached: true, limit: 0 });
    expect(spawn.mock.calls[0]![0].argv).toEqual(
      expect.arrayContaining(['--verify', '--cached', '--limit', '0']),
    );
    expect(locks.map(({ id, ours, owner }) => ({ id, ours, owner }))).toEqual([
      { id: '1', ours: true, owner: { name: '' } },
      { id: '2', ours: false, owner: { name: 'Owner' } },
    ]);
    await expect(repo.lfs.locks({ verify: true, local: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.lfs.locks({ cached: true, limit: 1 })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('handles empty lock JSON arrays and null', async () => {
    for (const json of ['[]', 'null', '{"ours":null,"theirs":null}']) {
      expect(await fixture(json).repo.lfs.locks()).toEqual([]);
    }
  });

  it('forwards migrate flags in their own modes and combines filter arrays', async () => {
    const { repo, spawn } = fixture();
    await repo.lfs.migrateInfo({
      include: ['*.bin', '*.dat'],
      unit: 'tib',
      pointers: 'follow',
      top: 2,
      refs: ['main'],
    });
    expect(spawn.mock.calls[0]![0].argv).toEqual(
      expect.arrayContaining([
        '--include=*.bin,*.dat',
        '--unit=tib',
        '--pointers=follow',
        '--top=2',
        '--',
        'main',
      ]),
    );
    await repo.lfs.migrateImport({
      noRewrite: true,
      files: ['a.bin'],
      message: 'Migrate file',
      objectMap: 'map.csv',
    });
    expect(spawn.mock.calls[1]![0].argv).toEqual(
      expect.arrayContaining([
        '--no-rewrite',
        '--message=Migrate file',
        '--object-map=map.csv',
        '--',
        'a.bin',
      ]),
    );
    await repo.lfs.migrateExport({ include: '*.bin', objectMap: 'export.csv', remote: 'origin' });
    expect(spawn.mock.calls[2]![0].argv).toEqual(
      expect.arrayContaining(['--object-map=export.csv', '--remote=origin']),
    );
    await expect(repo.lfs.migrateImport({ top: 3 } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      repo.lfs.migrateExport({ include: '*.bin', fixup: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawn).toHaveBeenCalledTimes(3);
  });
});
