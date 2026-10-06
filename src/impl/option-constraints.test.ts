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

  it('compares every LFS checkout stage/destination combination with the LFS parser', async () => {
    for (const options of assignments({
      base: [false, true],
      ours: [false, true],
      theirs: [false, true],
      to: [undefined, '', 'output'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'checkout'];
      if (options.base) {
        args.push('--base');
      }
      if (options.ours) {
        args.push('--ours');
      }
      if (options.theirs) {
        args.push('--theirs');
      }
      if (options.to !== undefined) {
        args.push(`--to=${options.to}`);
      }
      args.push('file');
      const result = raw(args);
      const optionError = /at most one of|must be used together/.test(
        result.stderr + result.stdout,
      );
      expect(optionError, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsCheckout, options).length > 0,
      );
      // A valid conflict invocation can still fail: this fixture has no unmerged index.
      if (!(options.base || options.ours || options.theirs || options.to)) {
        expect(result.status).toBe(0);
      }
    }
    await expect(repo.lfs.checkout('file', { ours: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await repo.lfs.checkout('file', { onProgress: () => undefined });
    const result = raw(['-C', repo.workdir, 'lfs', 'checkout', '--include=*.bin']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('unknown flag');
  });

  it('checks cached LFS lock constraints without contacting a server', async () => {
    for (const options of assignments({
      cached: [true],
      local: [false, true],
      verify: [false, true],
      limit: [undefined, -1, 0, 1],
      id: [undefined, '', '1'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'locks', '--json', '--cached'];
      if (options.local) {
        args.push('--local');
      }
      if (options.verify) {
        args.push('--verify');
      }
      if (options.limit !== undefined) {
        args.push(`--limit=${options.limit}`);
      }
      if (options.id !== undefined) {
        args.push(`--id=${options.id}`);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsLocks, options).length === 0,
      );
    }
    expect(await repo.lfs.locks({ cached: true })).toEqual([]);
    expect(await repo.lfs.locks({ cached: true, verify: true })).toEqual([]);
  }, 30000);

  it('compares LFS migrate info fixup combinations, including empty filters and default pointers', async () => {
    for (const options of assignments({
      fixup: [false, true],
      include: [undefined, '', '*.bin'],
      pointers: [undefined, 'follow', 'no-follow', 'ignore'],
    })) {
      const args = ['-C', repo.workdir, 'lfs', 'migrate', 'info', '--skip-fetch'];
      if (options.fixup) {
        args.push('--fixup');
      }
      if (options.include !== undefined) {
        args.push(`--include=${options.include}`);
      }
      if (options.pointers !== undefined) {
        args.push(`--pointers=${options.pointers}`);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.lfsMigrateInfo, options).length === 0,
      );
    }
    await expect(
      repo.lfs.migrateInfo({ fixup: true, pointers: 'follow' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
    await repo.lfs.migrateInfo({ fixup: true, pointers: 'ignore', skipFetch: true });
  }, 30000);

  it('checks LFS migrate import size thresholds and no-rewrite prerequisites', async () => {
    for (const above of ['0', '0.5b', '1b', '0.001kb']) {
      const options = { above, include: '*.bin' };
      const result = raw([
        '-C',
        repo.workdir,
        'lfs',
        'migrate',
        'import',
        '--skip-fetch',
        `--above=${above}`,
        '--include=*.bin',
      ]);
      expect(/Cannot use --above/.test(result.stderr), result.stderr).toBe(
        violations(COMMAND_CONSTRAINTS.lfsMigrateImport, options).length > 0,
      );
      if (above === '0' || above === '0.5b') {
        expect(result.status, result.stderr).toBe(0);
      }
    }
    const result = raw(['-C', repo.workdir, 'lfs', 'migrate', 'import', '--no-rewrite']);
    expect(result.stderr).toContain('Expected one or more files');
    await expect(repo.lfs.migrateImport({ noRewrite: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.lfs.migrateImport({ above: '1kb', include: '*.bin' })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.lfs.migrateExport({} as never)).rejects.toBeInstanceOf(GitArgumentError);
    const missing = raw(['-C', repo.workdir, 'lfs', 'migrate', 'export', '--skip-fetch']);
    expect(missing.stderr).toContain('must be specified with --include');
  });

  it('checks all reset modes and intent-to-add states against Git', async () => {
    for (const options of assignments({
      mode: [undefined, 'soft', 'mixed', 'hard', 'merge', 'keep'],
      intentToAdd: [undefined, false, true],
    })) {
      const args = ['-C', repo.workdir, 'reset'];
      if (options.mode) {
        args.push(`--${options.mode}`);
      }
      if (options.intentToAdd) {
        args.push('-N');
      }
      args.push('HEAD');
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.reset, options).length === 0,
      );
    }
    await expect(
      repo.reset('HEAD', { mode: 'hard', intentToAdd: true } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it('checks stash staged, untracked, all, file and explicit path combinations against Git', async () => {
    const file = join(root, 'paths');
    await writeFile(file, 'file\n');
    const help = raw(['-C', repo.workdir, 'stash', 'push', '-h']);
    const supportsStaged = (help.stdout + help.stderr).includes('--staged');
    for (const options of assignments({
      staged: supportsStaged ? [undefined, false, true] : [undefined, false],
      includeUntracked: [undefined, false, true],
      all: [undefined, false, true],
      pathspecFromFile: (help.stdout + help.stderr).includes('--pathspec-from-file')
        ? [undefined, file]
        : [undefined],
      paths: [undefined, [], ['file']],
    })) {
      const args = ['-C', repo.workdir, 'stash', 'push'];
      if (options.staged) {
        args.push('--staged');
      }
      if (options.includeUntracked) {
        args.push('--include-untracked');
      }
      if (options.all) {
        args.push('--all');
      }
      if (options.pathspecFromFile) {
        args.push(`--pathspec-from-file=${file}`);
      }
      if (Array.isArray(options.paths) && options.paths.length > 0) {
        args.push('--', ...options.paths);
      }
      const result = raw(args);
      expect(result.status === 0, `${JSON.stringify(options)}: ${result.stderr}`).toBe(
        violations(COMMAND_CONSTRAINTS.stashPush, options).length === 0,
      );
    }
    await expect(repo.stash.push({ staged: true, all: true } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  }, 30000);

  it('checks remote mirror modes and branch tracking against Git', async () => {
    let index = 0;
    for (const options of assignments({
      mirror: [undefined, 'fetch', 'push'],
      track: [undefined, 'main'],
    })) {
      const args = ['-C', repo.workdir, 'remote', 'add'];
      if (options.mirror) {
        args.push(`--mirror=${options.mirror}`);
      }
      if (options.track) {
        args.push('-t', String(options.track));
      }
      args.push(`remote-${index++}`, repo.workdir);
      const result = raw(args);
      expect(result.status === 0, result.stderr).toBe(
        violations(COMMAND_CONSTRAINTS.remoteAdd, options).length === 0,
      );
    }
    await expect(
      repo.remote.add('invalid', repo.workdir, { mirror: 'push', track: 'main' } as never),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });

  it.runIf(supportsSubmoduleFilter)(
    'accepts successive submodule strategies and requires init for filtering',
    async () => {
      const result = raw([
        '-C',
        repo.workdir,
        'submodule',
        'update',
        '--checkout',
        '--merge',
        '--rebase',
      ]);
      expect(result.status, result.stderr).toBe(0);
      await repo.submodule.update({ checkout: true, merge: true, rebase: true });
      const bad = raw(['-C', repo.workdir, 'submodule', 'update', '--filter=blob:none']);
      expect(bad.status).not.toBe(0);
      await expect(repo.submodule.update({ filter: 'blob:none' } as never)).rejects.toBeInstanceOf(
        GitArgumentError,
      );
      await repo.submodule.update({ init: true, filter: 'blob:none' });
    },
  );

  it('checks tag message sources and forwards empty messages', async () => {
    const file = join(root, 'message');
    await writeFile(file, 'annotation');
    const bad = raw(['-C', repo.workdir, 'tag', '-m', '', '-F', file, 'invalid']);
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toMatch(/cannot be used together|only one -F or -m option/);
    await expect(repo.tag.create('invalid', { message: '', file } as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await repo.tag.create('empty-message', { message: '' });
    expect((await repo.raw(['cat-file', '-t', 'empty-message'])).stdout.trim()).toBe('tag');
  });

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
