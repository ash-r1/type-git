/** `git.open(path, { untrusted: true })` keeps the repository's own hooks and config from running programs. */

import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { RuntimeAdapters } from '../core/adapters.js';
import type { Git } from '../core/git.js';
import { GitError } from '../core/types.js';
import {
  isDataOnlyRepoConfigEntry,
  isNetworkRemoteUrl,
  parseScopedConfigList,
  UNTRUSTED_REPO_MIN_GIT_VERSION,
  unsafeRepoConfigKeys,
  untrustedRepoConfigOverrides,
} from '../core/untrusted-repo.js';
import { CliRunner } from '../runner/cli-runner.js';
import { compareVersions, createGit, parseVersion } from './git-impl.js';

const USE_LEGACY_VERSION: boolean = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

/** Whether the Git under test supports untrusted mode (the legacy CI job runs Git 2.25). */
const GIT_VERSION: string = parseVersion(
  execFileSync('git', ['--version']).toString().replace('git version ', ''),
).join('.');
const SUPPORTS_UNTRUSTED: boolean =
  compareVersions(GIT_VERSION, UNTRUSTED_REPO_MIN_GIT_VERSION) >= 0;

function gitIn(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString();
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Expect `promise` to reject with an `UnsafeRepoConfig` error naming `keys`. */
async function expectRefused(promise: Promise<unknown>, keys: string[]): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(GitError);
  expect((error as GitError).kind).toBe('UnsafeRepoConfig');
  for (const key of keys) {
    expect((error as GitError).message).toContain(key);
  }
}

describe('isDataOnlyRepoConfigEntry', () => {
  it('accepts the keys git init and git clone write', () => {
    for (const key of [
      'core.repositoryformatversion',
      'core.filemode',
      'core.bare',
      'core.logallrefupdates',
      'core.ignorecase',
      'core.precomposeunicode',
      'remote.origin.fetch',
      'branch.main.merge',
      'submodule.lib.active',
      'lfs.repositoryformatversion',
      'index.sparse',
      'lfs.https://example.com/repo.git/info/lfs.access',
    ]) {
      expect(isDataOnlyRepoConfigEntry(key, 'x')).toBe(true);
    }
    for (const key of ['remote.origin.url', 'remote.my.dotted.name.pushurl', 'submodule.lib.url']) {
      expect(isDataOnlyRepoConfigEntry(key, 'https://example.com/repo.git')).toBe(true);
    }
    expect(isDataOnlyRepoConfigEntry('branch.main.remote', 'origin')).toBe(true);
  });

  it('accepts only network remote URLs', () => {
    for (const url of [
      'https://example.com/repo.git',
      'HTTP://example.com/repo.git',
      'ssh://git@example.com/repo.git',
      'git://example.com/repo.git',
      'git@github.com:owner/repo.git',
      'example.com:repo.git',
    ]) {
      expect(isNetworkRemoteUrl(url)).toBe(true);
    }
    for (const url of [
      '/srv/evil.git',
      '.git/evil.git',
      '../evil',
      'evil',
      '.',
      'file:///srv/evil.git',
      'C:/evil.git',
      'C:\\evil.git',
      '\\\\server\\share\\evil.git',
      'ext::sh -c evil',
      'fd::3',
      'evil::https://example.com/repo.git',
      'foo://example.com/repo.git',
      'https:///evil',
      './host:path',
      '',
    ]) {
      expect(isNetworkRemoteUrl(url)).toBe(false);
      expect(isDataOnlyRepoConfigEntry('remote.origin.url', url)).toBe(false);
    }
    expect(isDataOnlyRepoConfigEntry('remote.origin.url', undefined)).toBe(false);
  });

  it('accepts extensions.partialClone only when it names a remote', () => {
    expect(isDataOnlyRepoConfigEntry('extensions.partialClone', 'origin')).toBe(true);
    for (const value of ['../evil.git', '/srv/evil.git', 'https://x/y', '.', '']) {
      expect(isDataOnlyRepoConfigEntry('extensions.partialClone', value)).toBe(false);
    }
  });

  it('refuses a branch remote that spells a path or URL instead of a remote name', () => {
    for (const value of ['.', '.git/evil.git', '/srv/evil.git', 'https://x/y', 'a/b', 'C:x']) {
      expect(isDataOnlyRepoConfigEntry('branch.main.remote', value)).toBe(false);
      expect(isDataOnlyRepoConfigEntry('branch.main.pushRemote', value)).toBe(false);
    }
  });

  it('refuses rebase modes that start an editor', () => {
    for (const value of ['interactive', 'I', 'Interactive']) {
      expect(isDataOnlyRepoConfigEntry('pull.rebase', value)).toBe(false);
      expect(isDataOnlyRepoConfigEntry('branch.main.rebase', value)).toBe(false);
    }
    for (const value of ['true', 'false', 'merges']) {
      expect(isDataOnlyRepoConfigEntry('pull.rebase', value)).toBe(true);
      expect(isDataOnlyRepoConfigEntry('branch.main.rebase', value)).toBe(true);
    }
  });

  it('ignores case in section and variable names but not in subsections', () => {
    expect(isDataOnlyRepoConfigEntry('CORE.BARE', 'false')).toBe(true);
    expect(isDataOnlyRepoConfigEntry('Remote.origin.URL', 'https://example.com/r')).toBe(true);
    expect(isDataOnlyRepoConfigEntry('filter.LFS.clean', 'git-lfs clean -- %f')).toBe(false);
  });

  it('refuses keys that name a program, load files or redirect the worktree', () => {
    for (const key of [
      'core.fsmonitor',
      'core.hooksPath',
      'core.sshCommand',
      'core.gitProxy',
      'core.askPass',
      'core.editor',
      'core.pager',
      'core.worktree',
      'core.alternateRefsCommand',
      'include.path',
      'includeIf.gitdir:/x/.path',
      'alias.st',
      'diff.external',
      'diff.evil.textconv',
      'diff.evil.command',
      'merge.evil.driver',
      'filter.evil.smudge',
      'remote.origin.uploadpack',
      'remote.origin.receivepack',
      'remote.origin.vcs',
      'remote.origin.proxy',
      'submodule.lib.update',
      'url.ext::sh.insteadOf',
      'credential.helper',
      'credential.https://example.com.helper',
      'gpg.program',
      'sequence.editor',
      'trailer.sign.cmd',
      'uploadpack.packObjectsHook',
      'lfs.customtransfer.evil.path',
      'protocol.ext.allow',
      'safe.directory',
      'unknown.key',
      'nodot',
      'trailing.',
    ]) {
      expect(isDataOnlyRepoConfigEntry(key, 'x')).toBe(false);
    }
  });

  it('accepts filter.lfs only with the values git lfs install writes', () => {
    expect(isDataOnlyRepoConfigEntry('filter.lfs.clean', 'git-lfs clean -- %f')).toBe(true);
    expect(isDataOnlyRepoConfigEntry('filter.lfs.smudge', 'git-lfs smudge --skip -- %f')).toBe(
      true,
    );
    expect(isDataOnlyRepoConfigEntry('filter.lfs.process', 'git-lfs filter-process')).toBe(true);
    expect(isDataOnlyRepoConfigEntry('filter.lfs.required', 'true')).toBe(true);
    expect(isDataOnlyRepoConfigEntry('filter.lfs.smudge', 'sh -c evil')).toBe(false);
    expect(isDataOnlyRepoConfigEntry('filter.lfs.process', undefined)).toBe(false);
    expect(isDataOnlyRepoConfigEntry('filter.lfs.textconv', 'git-lfs clean -- %f')).toBe(false);
  });
});

describe('untrustedRepoConfigOverrides', () => {
  it('points hooks at a path that cannot be a directory', () => {
    expect(untrustedRepoConfigOverrides('linux', '/usr/bin/node')).toEqual([
      'core.hooksPath=/dev/null',
      'core.fsmonitor=',
      'protocol.ext.allow=never',
      'safe.bareRepository=explicit',
    ]);
    expect(untrustedRepoConfigOverrides('win32', 'C:\\node\\node.exe')[0]).toBe(
      'core.hooksPath=C:\\node\\node.exe/no-hooks',
    );
  });
});

describe('unsafeRepoConfigKeys', () => {
  it('reads only the local and worktree scopes and reports each key once', () => {
    const stdout =
      'global\0core.fsmonitor\ntrusted\0' +
      'command\0alias.x\n!x\0' +
      'local\0core.bare\nfalse\0' +
      'local\0core.fsmonitor\nevil\0' +
      'local\0alias.st\0' +
      'worktree\0core.fsmonitor\nevil\0' +
      'worktree\0diff.x.textconv\nevil\0';
    const entries = parseScopedConfigList(stdout);
    expect(entries[4]).toEqual({ scope: 'local', key: 'alias.st', value: undefined });
    expect(entries[1]).toEqual({ scope: 'command', key: 'alias.x', value: '!x' });
    expect(unsafeRepoConfigKeys(entries)).toEqual([
      'core.fsmonitor',
      'alias.st',
      'diff.x.textconv',
    ]);
  });

  it('accepts a key that names a remote only for a remote with its own URL', () => {
    const entries = parseScopedConfigList(
      'local\0remote.origin.url\nhttps://example.com/r.git\0' +
        'local\0branch.main.remote\norigin\0' +
        'local\0extensions.partialclone\norigin\0' +
        'local\0branch.main.pushremote\nevil\0' +
        'global\0remote.trusted.url\nhttps://example.com/t.git\0' +
        'local\0branch.dev.remote\ntrusted\0',
    );
    // `evil` has no URL, so Git would read it as a path; `trusted` is not the repository's own.
    expect(unsafeRepoConfigKeys(entries)).toEqual(['branch.main.pushremote', 'branch.dev.remote']);
  });

  it('keeps a newline inside a value', () => {
    expect(parseScopedConfigList('local\0user.name\na\nb\0')).toEqual([
      { scope: 'local', key: 'user.name', value: 'a\nb' },
    ]);
  });
});

describe('CliRunner config overrides', () => {
  function fixture(): { adapters: RuntimeAdapters; spawn: ReturnType<typeof vi.fn> } {
    const spawn = vi
      .fn()
      .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, aborted: false });
    const adapters = { exec: { spawn }, fs: {} } as unknown as RuntimeAdapters;
    return { adapters, spawn };
  }

  it('passes the overrides with -c after the credential helper, and to companion programs', async () => {
    const { adapters, spawn } = fixture();
    const runner = new CliRunner(adapters, { credential: { helper: 'fixture' } }).withOptions({
      configOverrides: ['a.b=1', "c.d=it's"],
    });
    const context = { type: 'worktree', workdir: '/repo' } as const;
    await runner.run(context, ['status']);
    expect(spawn.mock.calls[0]?.[0].argv).toEqual([
      'git',
      '-c',
      'credential.helper=fixture',
      '-c',
      'a.b=1',
      '-c',
      "c.d=it's",
      '-C',
      '/repo',
      'status',
    ]);
    await runner.runCompanion(context, 'scalar', ['version']);
    expect(spawn.mock.calls[1]?.[0].env.GIT_CONFIG_PARAMETERS).toBe(
      "'credential.helper=fixture' 'a.b=1' 'c.d=it'\\''s'",
    );
  });

  it('keeps the parent overrides when withOptions adds more', async () => {
    const { adapters, spawn } = fixture();
    const runner = new CliRunner(adapters, { configOverrides: ['a.b=1'] })
      .withOptions({ env: { X: '1' } })
      .withOptions({ configOverrides: ['c.d=2'] });
    await runner.run({ type: 'global' }, ['version']);
    expect(spawn.mock.calls[0]?.[0].argv).toEqual(['git', '-c', 'a.b=1', '-c', 'c.d=2', 'version']);
  });
});

describe.runIf(!SUPPORTS_UNTRUSTED)('git.open with untrusted: true on old Git', () => {
  it('refuses to open with UnsupportedGitVersion', async () => {
    const git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
    const tempDir = await mkdtemp(join(tmpdir(), 'type-git-untrusted-old-'));
    try {
      execFileSync('git', ['init', '-q', tempDir]);
      const error = await git.open(tempDir, { untrusted: true }).then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(GitError);
      expect((error as GitError).kind).toBe('UnsupportedGitVersion');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe.runIf(SUPPORTS_UNTRUSTED)('git.open with untrusted: true', () => {
  let git: Git;
  let tempDir: string;
  let work: string;
  let marker: string;
  let script: string;

  beforeAll(async () => {
    git = await createGit({ adapters: createNodeAdapters(), useLegacyVersion: USE_LEGACY_VERSION });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-untrusted-'));
    work = join(tempDir, 'work');
    marker = join(tempDir, 'ran');
    script = join(tempDir, 'payload.sh');
    // A program that records that it ran; Git runs it through sh on every platform.
    await writeFile(script, `#!/bin/sh\necho ran > "${marker.replace(/\\/g, '/')}"\n`);
    await chmod(script, 0o755);
    execFileSync('git', ['init', '-q', work]);
    gitIn(work, ['config', 'user.name', 'Fixture']);
    gitIn(work, ['config', 'user.email', 'fixture@example.com']);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('opens a repository that git init and git clone created', async () => {
    const repo = await git.open(work, { untrusted: true });
    expect(await repo.status()).toBeDefined();
    const clone = join(tempDir, 'clone');
    execFileSync('git', ['clone', '-q', work, clone]);
    // A clone from a local path records that path, which untrusted mode refuses.
    await expectRefused(git.open(clone, { untrusted: true }), ['remote.origin.url']);
    gitIn(clone, ['remote', 'set-url', 'origin', 'https://example.com/repo.git']);
    await expect(git.open(clone, { untrusted: true })).resolves.toBeDefined();
  });

  it('refuses a repository whose config names a program, without running it', async () => {
    const program = script.replace(/\\/g, '/');
    gitIn(work, ['config', 'core.fsmonitor', program]);
    gitIn(work, ['config', 'diff.evil.textconv', program]);
    await expectRefused(git.open(work, { untrusted: true }), [
      'core.fsmonitor',
      'diff.evil.textconv',
    ]);
    expect(await exists(marker)).toBe(false);
  });

  it('refuses keys that come from an included file', async () => {
    const included = join(tempDir, 'included.config');
    await writeFile(included, '[alias]\n\tst = !evil\n');
    gitIn(work, ['config', 'include.path', included.replace(/\\/g, '/')]);
    await expectRefused(git.open(work, { untrusted: true }), ['include.path', 'alias.st']);
  });

  it('refuses keys from the worktree scope', async () => {
    gitIn(work, ['config', 'extensions.worktreeConfig', 'true']);
    gitIn(work, ['config', '--worktree', 'core.sshCommand', 'evil']);
    // Git lists section and variable names in lower case.
    await expectRefused(git.open(work, { untrusted: true }), ['core.sshcommand']);
  });

  it('refuses unsafe keys in a bare repository', async () => {
    const bare = join(tempDir, 'bare.git');
    execFileSync('git', ['init', '-q', '--bare', bare]);
    await expect(git.openBare(bare, { untrusted: true })).resolves.toBeDefined();
    gitIn(bare, ['config', 'remote.origin.uploadpack', 'evil']);
    await expectRefused(git.openBare(bare, { untrusted: true }), ['remote.origin.uploadpack']);
  });

  it('refuses a local-path remote, whose own hooks would run on push', async () => {
    const evil = join(work, '.git', 'evil.git');
    execFileSync('git', ['init', '-q', '--bare', evil]);
    const hook = join(evil, 'hooks', 'pre-receive');
    await writeFile(hook, `#!/bin/sh\nexec sh "${script.replace(/\\/g, '/')}"\n`);
    await chmod(hook, 0o755);
    gitIn(work, ['commit', '-q', '--allow-empty', '-m', 'init']);
    gitIn(work, ['remote', 'add', 'origin', '.git/evil.git']);
    await expectRefused(git.open(work, { untrusted: true }), ['remote.origin.url']);

    // Git drops the -c overrides for the local transport, so the hook would run.
    gitIn(work, ['-c', 'core.hooksPath=/dev/null', 'push', '-q', 'origin', 'HEAD:refs/heads/x']);
    expect(await exists(marker)).toBe(true);
  });

  it('refuses a .git directory, or a path inside one, with a clear message', async () => {
    // Git versions differ on whether safe.bareRepository=explicit stops `-C <worktree>/.git`;
    // either way the open is refused.
    for (const path of [join(work, '.git'), join(work, '.git', 'refs')]) {
      const error = await git.open(path, { untrusted: true }).then(
        () => undefined,
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(GitError);
      // Older Git cannot resolve a path inside .git under `explicit` at all.
      expect((error as GitError).message).toMatch(/top-level directory|Not a git repository/);
    }
    await expect(git.open(join(work, '.git'))).resolves.toBeDefined();
  });

  it('checks the configuration of populated submodules', async () => {
    const upstream = join(tempDir, 'upstream');
    execFileSync('git', ['init', '-q', upstream]);
    gitIn(upstream, [
      '-c',
      'user.name=F',
      '-c',
      'user.email=f@example.com',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'x',
    ]);
    gitIn(work, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'lib']);
    const sub = join(work, 'lib');
    // Clear the local-path URLs that `submodule add` records, which untrusted mode refuses.
    gitIn(work, ['config', 'submodule.lib.url', 'https://example.com/lib.git']);
    gitIn(sub, ['remote', 'set-url', 'origin', 'https://example.com/lib.git']);
    await expect(git.open(work, { untrusted: true })).resolves.toBeDefined();

    gitIn(sub, ['config', 'filter.evil.clean', script.replace(/\\/g, '/')]);
    await expectRefused(git.open(work, { untrusted: true }), [
      'submodule lib',
      'filter.evil.clean',
    ]);
    gitIn(sub, ['config', '--unset', 'filter.evil.clean']);

    // A submodule must keep its own directory as worktree.
    const elsewhere = join(tempDir, 'elsewhere');
    execFileSync('git', ['init', '-q', elsewhere]);
    gitIn(sub, ['config', 'core.worktree', elsewhere.replace(/\\/g, '/')]);
    await expectRefused(git.open(work, { untrusted: true }), ['submodule lib', 'core.worktree']);
  });

  it('refuses a partial-clone remote that is not configured, which Git reads as a path', async () => {
    execFileSync('git', ['init', '-q', '--bare', join(work, 'evil.git')]);
    gitIn(work, ['config', 'core.repositoryformatversion', '1']);
    gitIn(work, ['config', 'extensions.partialClone', 'evil.git']);
    await expectRefused(git.open(work, { untrusted: true }), ['extensions.partialclone']);

    gitIn(work, ['remote', 'add', 'evil.git', 'https://example.com/repo.git']);
    await expect(git.open(work, { untrusted: true })).resolves.toBeDefined();
  });

  it('refuses legacy remotes/ and branches/ files, which define remotes outside the config', async () => {
    for (const dir of ['remotes', 'branches']) {
      const legacy = join(work, '.git', dir);
      await mkdir(legacy, { recursive: true });
      await writeFile(
        join(legacy, 'origin'),
        dir === 'remotes' ? 'URL: ../evil.git\n' : '../evil.git\n',
      );
      await expectRefused(git.open(work, { untrusted: true }), [dir]);
      await rm(join(legacy, 'origin'));
    }
    // An empty directory, which `git init` creates for branches/ on some versions, is fine.
    await expect(git.open(work, { untrusted: true })).resolves.toBeDefined();
  });

  // Windows does not allow a newline or carriage return in a file name.
  it.skipIf(process.platform === 'win32').each([
    ['a newline inside', join('name\nsuffix', 'work')],
    ['a carriage return at the end of', 'work\r'],
  ])(
    'keeps %s the repository path when it checks legacy files and submodules',
    async (_what, name) => {
      const odd = join(tempDir, name);
      await mkdir(odd, { recursive: true });
      execFileSync('git', ['init', '-q', odd]);
      const upstream = join(tempDir, 'upstream');
      execFileSync('git', ['init', '-q', upstream]);
      gitIn(upstream, [
        '-c',
        'user.name=F',
        '-c',
        'user.email=f@example.com',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'x',
      ]);
      gitIn(odd, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', upstream, 'lib']);
      const sub = join(odd, 'lib');
      gitIn(odd, ['config', 'submodule.lib.url', 'https://example.com/lib.git']);
      gitIn(sub, ['remote', 'set-url', 'origin', 'https://example.com/lib.git']);
      await expect(git.open(odd, { untrusted: true })).resolves.toBeDefined();

      gitIn(sub, ['config', 'filter.evil.clean', script]);
      await expectRefused(git.open(odd, { untrusted: true }), [
        'submodule lib',
        'filter.evil.clean',
      ]);
      gitIn(sub, ['config', '--unset', 'filter.evil.clean']);

      const legacy = join(odd, '.git', 'remotes');
      await mkdir(legacy, { recursive: true });
      await writeFile(join(legacy, 'origin'), 'URL: ../evil.git\n');
      await expectRefused(git.open(odd, { untrusted: true }), ['remotes']);
    },
  );

  it('opens a repository without untrusted mode as before', async () => {
    gitIn(work, ['config', 'alias.st', 'status']);
    await expect(git.open(work)).resolves.toBeDefined();
  });

  it('runs no hook from the repository', async () => {
    const hook = join(work, '.git', 'hooks', 'pre-commit');
    await writeFile(hook, `#!/bin/sh\nexec sh "${script.replace(/\\/g, '/')}"\n`);
    await chmod(hook, 0o755);

    const untrusted = await git.open(work, { untrusted: true });
    await untrusted.commit({ message: 'untrusted', allowEmpty: true });
    expect(await exists(marker)).toBe(false);

    // The same hook runs without untrusted mode, so the check above is meaningful.
    const trusted = await git.open(work);
    await trusted.commit({ message: 'trusted', allowEmpty: true });
    expect(await exists(marker)).toBe(true);
  });

  it('passes the overrides to every command, including raw()', async () => {
    const argvs: string[][] = [];
    const audited = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
      audit: { onAudit: (event) => event.type === 'start' && argvs.push(event.argv) },
    });
    argvs.length = 0;
    const repo = await audited.open(work, { untrusted: true });
    await repo.raw(['status']);
    const expected = untrustedRepoConfigOverrides().flatMap((parameter) => ['-c', parameter]);
    expect(argvs.length).toBeGreaterThan(0);
    for (const argv of argvs) {
      expect(argv.slice(1, 1 + expected.length)).toEqual(expected);
    }
  });
});
