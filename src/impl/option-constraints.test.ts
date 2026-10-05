import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { COMMAND_CONSTRAINTS } from '../constraints/commands.js';
import { assignments } from '../constraints/explore.js';
import { violations } from '../constraints/model.js';
import type { CloneOpts, Git } from '../core/git.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGitSync } from './git-impl.js';

const supportsSubmoduleFilter = spawnSync('git', ['clone', '-h'], {
  encoding: 'utf8',
}).stdout.includes('also-filter-submodules');

describe('option constraints against independent Git executions', () => {
  let root: string;
  let git: Git;
  let repo: WorktreeRepo;
  let environment: NodeJS.ProcessEnv;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-options-'));
    environment = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'empty-config'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_TERMINAL_PROMPT: '0',
    };
    await writeFile(join(root, 'empty-config'), '');
    git = createGitSync({
      adapters: createNodeAdapters(),
      home: root,
      inheritEnv: false,
      env: environment,
    });
    repo = await git.init(join(root, 'source'));
    await repo.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    await writeFile(join(repo.workdir, 'file'), 'initial\n');
    await repo.add('file');
    await repo.commit({ message: 'initial' });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function raw(args: string[]) {
    const result = spawnSync('git', args, { env: environment, encoding: 'utf8', timeout: 15000 });
    if (result.error) {
      throw result.error;
    }
    expect(result.signal).toBeNull();
    return result;
  }

  it('exhaustively checks clone layout combinations against Git, including successful cases', async () => {
    let index = 0;
    for (const o of assignments({
      bare: [undefined, false, true],
      mirror: [undefined, false, true],
      separateGitDir: [undefined, 'separate'],
    })) {
      const options = {
        ...o,
        ...(o.separateGitDir ? { separateGitDir: join(root, `gitdir-${index}`) } : {}),
      };
      // Hand-written CLI oracle: does not use the library argument builder or rule predicates.
      const args = ['clone'];
      if (options.bare === true) {
        args.push('--bare');
      }
      if (options.mirror === true) {
        args.push('--mirror');
      }
      if (options.separateGitDir) {
        args.push('--separate-git-dir', String(options.separateGitDir));
      }
      args.push(repo.workdir, join(root, `raw-${index}`));
      const result = raw(args);
      const rejected = violations(COMMAND_CONSTRAINTS.clone, options).length > 0;
      expect(result.status === 0, `${JSON.stringify(o)}: ${result.stderr}`).toBe(!rejected);
      const typedOptions = {
        ...options,
        ...(o.separateGitDir ? { separateGitDir: join(root, `typed-gitdir-${index}`) } : {}),
      } as CloneOpts;
      const call = git.clone(repo.workdir, join(root, `typed-${index++}`), typedOptions);
      if (rejected) {
        await expect(call).rejects.toBeInstanceOf(GitArgumentError);
      } else {
        expect((await call).kind).toBe(options.bare || options.mirror ? 'bare' : 'worktree');
      }
    }
  }, 30000);

  it.runIf(supportsSubmoduleFilter)(
    'exhaustively checks submodule filter prerequisites against Git',
    async () => {
      let index = 0;
      for (const options of assignments({
        alsoFilterSubmodules: [undefined, false, true],
        filter: [undefined, 'blob:none'],
        recurseSubmodules: [undefined, false, true],
      })) {
        const args = ['clone'];
        if (options.alsoFilterSubmodules === true) {
          args.push('--also-filter-submodules');
        }
        if (options.filter) {
          args.push('--filter', String(options.filter));
        }
        if (options.recurseSubmodules === true) {
          args.push('--recurse-submodules');
        }
        args.push(repo.workdir, join(root, `filter-raw-${index}`));
        const result = raw(args);
        const rejected = violations(COMMAND_CONSTRAINTS.clone, options).length > 0;
        expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(!rejected);
        const call = git.clone(
          repo.workdir,
          join(root, `filter-typed-${index++}`),
          options as CloneOpts,
        );
        if (rejected) {
          await expect(call).rejects.toBeInstanceOf(GitArgumentError);
        } else {
          await expect(call).resolves.toHaveProperty('kind', 'worktree');
        }
      }
    },
    30000,
  );

  it('accepts locally ignored shallow combinations, zero jobs, and both address-family flags', async () => {
    const options = {
      depth: 1,
      shallowSince: '2020-01-01',
      shallowExclude: 'main',
      jobs: 0,
      ipv4: true,
      ipv6: true,
    };
    const result = raw([
      'clone',
      '--depth=1',
      '--shallow-since=2020-01-01',
      '--shallow-exclude=main',
      '--jobs=0',
      '--ipv4',
      '--ipv6',
      repo.workdir,
      join(root, 'raw-shallow'),
    ]);
    expect(result.status, result.stderr).toBe(0);
    await expect(
      git.clone(repo.workdir, join(root, 'typed-shallow'), options),
    ).resolves.toHaveProperty('kind', 'worktree');
  });

  it('preserves Git precedence for diff output, status rename controls, date aliases, and signing', async () => {
    await writeFile(join(repo.workdir, 'file'), 'changed\n');
    expect(
      await repo.diff(undefined, { nameOnly: true, patch: true, stat: true, context: 1 }),
    ).toEqual(['file']);
    expect(
      (await repo.diff(undefined, { nameStatus: true, numstat: true, patchWithStat: true })).files,
    ).toEqual([{ path: 'file', status: 'M' }]);
    expect((await repo.diff(undefined, { stat: true, numstat: true, patch: true })).raw).toContain(
      'diff --git',
    );
    const result = raw([
      '-C',
      repo.workdir,
      'log',
      '--since=2100-01-01',
      '--after=2000-01-01',
      '--format=%H',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(
      (await repo.log({ since: '2100-01-01', after: '2000-01-01' })).map((c) => c.hash),
    ).toEqual(result.stdout.trim().split('\n'));
    expect(await repo.log({ merges: true, noMerges: true })).toEqual([]);
    await expect(repo.status({ noRenames: true, findRenames: true })).resolves.toHaveProperty(
      'entries',
    );
    expect((await repo.log({ maxCount: -1, skip: -1 })).length).toBeGreaterThan(0);
    await expect(repo.diff(undefined, { abbrev: -1, renameLimit: -1 })).resolves.toHaveProperty(
      'raw',
    );
    await expect(repo.lsTree('HEAD', { abbrev: -1 })).resolves.toHaveLength(1);
    await repo.add('file');
    await expect(
      repo.commit({ message: 'unsigned', gpgSign: true, noGpgSign: true }),
    ).resolves.toHaveProperty('hash');
    await repo.raw(['mv', 'file', 'renamed']);
    expect((await repo.status({ noRenames: true, findRenames: true })).entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'renamed', index: 'R' })]),
    );
  });

  it('passes accepted force/lease and tag combinations through to Git', async () => {
    const remote = await git.init(join(root, 'remote'), { bare: true });
    await repo.remote.add('origin', remote.gitDir);
    await repo.push({
      remote: 'origin',
      repo: remote.gitDir,
      refspec: 'main',
      force: true,
      forceWithLease: { refname: 'refs/heads/main', expect: '' },
    });
    await repo.fetch({ remote: 'origin', tags: true, noTags: true, jobs: 0, deepen: 0 });
    expect((await remote.raw(['rev-parse', 'main'])).stdout.trim()).toBe(
      (await repo.raw(['rev-parse', 'HEAD'])).stdout.trim(),
    );
  });

  it('rejects missing clone dependencies before any spawn and preserves sequencer options', async () => {
    const adapters = createNodeAdapters();
    const spy = vi.spyOn(adapters.exec, 'spawn');
    const client = createGitSync({ adapters, home: root, env: environment });
    await expect(
      client.clone(repo.workdir, join(root, 'bad'), { alsoFilterSubmodules: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spy).not.toHaveBeenCalled();
    const checked = await client.open(repo.workdir);
    // No operation is in progress: the error must come from Git, after serialization.
    await expect(checked.rebase({ abort: true, quiet: true })).rejects.not.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(
      checked.cherryPick([], { continue: true, cleanup: 'strip' }),
    ).rejects.not.toBeInstanceOf(GitArgumentError);
    await expect(
      checked.push({ remote: 'missing', force: true, forceWithLease: true }),
    ).rejects.not.toBeInstanceOf(GitArgumentError);
    expect(
      spy.mock.calls.some(
        ([{ argv }]) => argv.includes('--force') && argv.includes('--force-with-lease'),
      ),
    ).toBe(true);
    expect(
      spy.mock.calls.some(([{ argv }]) => argv.includes('--abort') && argv.includes('--quiet')),
    ).toBe(true);
    expect(
      spy.mock.calls.some(
        ([{ argv }]) => argv.includes('--continue') && argv.includes('--cleanup'),
      ),
    ).toBe(true);
  });
});
