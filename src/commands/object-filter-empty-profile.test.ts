import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import {
  objectFilterCombineEmptyComponents,
  objectFilterUsesEmptyComponent,
  validObjectFilter,
} from '../constraints/object-filter.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { commandArguments } from './build.js';

const empty = [
  'combine:+',
  'combine:++',
  'combine:blob:none+',
  'combine:+blob:none',
  'combine:blob:none++tree:1',
  'combine:combine:blob:none%2B',
  'combine:tree:1+combine:%2Bblob:none',
];
const nonEmpty = ['combine:blob:none+tree:1', 'combine:combine:blob:none%2Btree:1', 'blob:none'];

describe('selected Git empty combined-filter components', () => {
  it('skips empty components only in the Git 2.54+ profile', () => {
    for (const filter of empty) {
      expect(validObjectFilter(filter), filter).toBe(true);
      expect(validObjectFilter(filter, false, 64, true, false, true, false), filter).toBe(false);
      expect(objectFilterUsesEmptyComponent(filter), filter).toBe(true);
    }
    for (const filter of nonEmpty) {
      expect(validObjectFilter(filter, false, 64, true, false, true, false), filter).toBe(true);
      expect(objectFilterUsesEmptyComponent(filter), filter).toBe(false);
    }
    // A sparse object name is not reparsed as a combined filter.
    expect(objectFilterUsesEmptyComponent('combine:sparse:oid=a%2B')).toBe(false);
    expect(validObjectFilter('combine:', false, 64, true, false, true, true)).toBe(false);
  });

  it('propagates the selected profile through command validation', () => {
    for (const combineEmptyComponents of [false, true]) {
      const build = () =>
        commandArguments('cat-file', [['--filter', 'combine:blob:none+'], ['-h']], true, {
          longBits: 64,
          sizeTBits: 64,
          combineEmptyComponents,
        });
      if (combineEmptyComponents) {
        expect(build).not.toThrow();
      } else {
        expect(build).toThrow(GitArgumentError);
      }
    }
  });

  it('classifies only recognized probe outcomes', () => {
    expect(
      objectFilterCombineEmptyComponents({ exitCode: 129, stdout: 'usage: git clone', stderr: '' }),
    ).toBe(true);
    expect(
      objectFilterCombineEmptyComponents({
        exitCode: 128,
        stdout: '',
        stderr: "fatal: invalid filter-spec 'blob:none+'\n",
      }),
    ).toBe(false);
    expect(
      objectFilterCombineEmptyComponents({ exitCode: 128, stdout: '', stderr: 'custom' }),
    ).toBeUndefined();
    expect(
      objectFilterCombineEmptyComponents({ exitCode: 0, stdout: 'usage: git clone', stderr: '' }),
    ).toBeUndefined();
  });

  it('matches the installed executable without a transport URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-empty-filter-'));
    try {
      const env = {
        ...process.env,
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'config'),
        LC_ALL: 'C',
      };
      const runner = new CliRunner(createNodeAdapters(), { home: root, inheritEnv: false, env });
      for (const filter of [...empty, ...nonEmpty]) {
        const native = spawnSync('git', ['clone', `--filter=${filter}`, '-h'], {
          env,
          encoding: 'utf8',
          timeout: 5000,
        });
        expect(native.error).toBeUndefined();
        const call = runner.runCommand({ type: 'global' }, 'clone', [['--filter', filter], ['-h']]);
        if (native.status === 128) {
          expect(native.stderr, filter).toContain('invalid filter-spec');
          await expect(call, filter).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          expect(native.stdout + native.stderr, filter).toContain('usage:');
          const actual = await call;
          expect(actual.exitCode, filter).toBe(native.status);
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const skips of [false, true]) {
    it(`propagates ${skips ? 'skipped' : 'rejected'} empty components to convenience validation`, async () => {
      const adapters = createNodeAdapters();
      adapters.exec.spawn = vi.fn().mockResolvedValue({
        exitCode: skips ? 129 : 128,
        stdout: skips ? 'usage: git clone\n' : '',
        stderr: skips ? '' : "fatal: invalid filter-spec 'blob:none+'\n",
        aborted: false,
      });
      const runner = new CliRunner(adapters, { gitBinary: '/selected/git' });
      const promise = runner.validateFilterOptions(
        { type: 'worktree', workdir: '/repo' },
        'clone',
        { filter: 'combine:blob:none++tree:1' },
      );
      if (skips) {
        await expect(promise).resolves.toBeUndefined();
      } else {
        await expect(promise).rejects.toBeInstanceOf(GitArgumentError);
      }
      expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
      expect(adapters.exec.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: ['/selected/git', '-C', '/repo', 'clone', '--filter=combine:blob:none+', '-h'],
          stdin: undefined,
        }),
        undefined,
      );
    });
  }

  it('does not probe filters without empty components', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn();
    await new CliRunner(adapters).validateFilterOptions({ type: 'global' }, 'clone', {
      filter: 'combine:blob:none+tree:1',
    });
    expect(adapters.exec.spawn).not.toHaveBeenCalled();
  });
});
