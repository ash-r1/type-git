/**
 * `git.clone(url, path, { config })` accepts only data-only config keys.
 *
 * `git clone -c` applies the key to the initial fetch and writes it into the new repository, so a
 * key such as `protocol.ext.allow=always` with an `ext::` URL, or `include.path` naming a file
 * that sets `core.fsmonitor`, runs a command. These tests use a marker file to prove nothing ran.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { type CloneConfig, cloneConfigArgs, isCloneConfigKey } from '../core/clone-config.js';
import type { Git } from '../core/git.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGit } from './git-impl.js';

const USE_LEGACY_VERSION: boolean = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('isCloneConfigKey', () => {
  it.each([
    'user.name',
    'core.autocrlf',
    'protocol.version',
    'http.extraHeader',
    'http.sslCAInfo',
    'http.https://example.com/.extraHeader',
    'http.https://example.com/path.git.proxy',
    // Git ignores case in section and variable names.
    'HTTP.ExtraHeader',
    'Http.https://Example.com/.SSLVERIFY',
    'USER.NAME',
    // An empty or tab-holding subsection matches nothing in Git, but cannot reach another key.
    'http..proxy',
    'http.https://ex\tample/.proxy',
  ])('accepts %j', (key) => {
    expect(isCloneConfigKey(key)).toBe(true);
  });

  it.each([
    'protocol.ext.allow',
    'PROTOCOL.ext.ALLOW',
    'protocol.allow',
    'include.path',
    'includeIf.gitdir:/.path',
    'core.sshCommand',
    'core.fsmonitor',
    'core.hooksPath',
    'core.pager',
    'core.editor',
    'core.gitProxy',
    'remote.origin.uploadpack',
    'remote.origin.url',
    'credential.helper',
    'credential.https://example.com.helper',
    'trailer.x.cmd',
    'alias.x',
    'filter.lfs.smudge',
    'diff.external',
    'submodule.x.update',
    'url.https://evil/.insteadOf',
    'http.cookieFile',
    // Keys that switch off Git's protections against a malicious repository.
    'core.protectNTFS',
    'core.protectHFS',
    'fetch.fsckObjects',
    'transfer.fsckObjects',
    // Git folds only ASCII case; U+212A KELVIN SIGN is not `k`.
    'core.sparseChec\u212Aout',
    ' user.name',
    'user.name ',
    'http.https://example.com/.cookieFile',
    // `user` takes no subsection; only `http` does.
    'user.x.name',
    'http.',
    '.name',
    'user',
    '',
    'user.name=x',
    'http.https://a=b/.proxy',
    'user.na\nme',
    'http.https://example.com/\n.proxy',
  ])('refuses %j', (key) => {
    expect(isCloneConfigKey(key)).toBe(false);
  });
});

describe('cloneConfigArgs', () => {
  it('emits one -c pair per entry and skips undefined values', () => {
    expect(
      cloneConfigArgs({ 'user.name': 'A B', 'core.autocrlf': undefined, 'http.version': 'HTTP/2' }),
    ).toEqual(['-c', 'user.name=A B', '-c', 'http.version=HTTP/2']);
  });

  it('skips an undefined value without checking its key', () => {
    expect(cloneConfigArgs({ 'include.path': undefined })).toEqual([]);
  });

  it('keeps "=" and tabs inside values', () => {
    expect(cloneConfigArgs({ 'http.extraHeader': 'Authorization: a=b\tc' })).toEqual([
      '-c',
      'http.extraHeader=Authorization: a=b\tc',
    ]);
  });

  it.each(['a\nb', 'a\rb', 'a\0b'])('refuses a value containing %j', (value) => {
    expect(() => cloneConfigArgs({ 'http.extraHeader': value })).toThrow(GitArgumentError);
  });

  it('refuses a non-string value', () => {
    expect(() => cloneConfigArgs({ 'user.name': 1 })).toThrow(GitArgumentError);
  });
});

describe('git.clone config', () => {
  let git: Git;
  let tempDir: string;
  let upstream: string;
  let marker: string;

  beforeAll(async () => {
    git = await createGit({ adapters: createNodeAdapters(), useLegacyVersion: USE_LEGACY_VERSION });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-clone-config-'));
    marker = join(tempDir, 'pwned');
    upstream = join(tempDir, 'upstream');
    execFileSync('git', ['init', '-q', upstream]);
    execFileSync('git', [
      '-C',
      upstream,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'initial',
    ]);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function expectRefused(url: string, config: Record<string, string>): Promise<void> {
    const destination = join(tempDir, 'clone');
    await expect(
      git.clone(url, destination, { config: config as CloneConfig }),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(destination)).toBe(false);
  }

  it('refuses protocol.ext.allow, which would run an ext:: transport command', async () => {
    const url = `ext::sh -c touch% ${marker}`;
    await expectRefused(url, { 'protocol.ext.allow': 'always' });
    await expectRefused(url, { 'PROTOCOL.ext.ALLOW': 'always' });
    await expectRefused(url, { 'protocol.allow': 'always' });
  });

  it('refuses include.path, which would load a config that runs core.fsmonitor', async () => {
    const included = join(tempDir, 'evil.cfg');
    await writeFile(included, `[core]\n\tfsmonitor = touch ${marker}; false\n`);
    await expectRefused(upstream, { 'include.path': included });
    await expectRefused(upstream, { [`includeIf.gitdir:${tempDir}/.path`]: included });
  });

  it('refuses keys that name a program', async () => {
    for (const key of [
      'core.sshCommand',
      'core.fsmonitor',
      'core.hooksPath',
      'remote.origin.uploadpack',
      'credential.helper',
      'trailer.x.cmd',
      'alias.x',
    ]) {
      await expectRefused(upstream, { [key]: `touch ${marker}` });
    }
  });

  it('refuses a key before any Git process starts, including option probes', async () => {
    const adapters = createNodeAdapters();
    let spawned = 0;
    const counting = await createGit({
      adapters: {
        ...adapters,
        exec: new Proxy(adapters.exec, {
          get(target, property, receiver): unknown {
            const value = Reflect.get(target, property, receiver);
            if (
              (property === 'spawn' || property === 'spawnBytes') &&
              typeof value === 'function'
            ) {
              return (...args: unknown[]): unknown => {
                spawned += 1;
                return value.apply(target, args);
              };
            }
            return value;
          },
        }),
      },
      useLegacyVersion: USE_LEGACY_VERSION,
    });
    // createGit probes the Git version; count only what clone starts.
    spawned = 0;
    await expect(
      counting.clone(upstream, join(tempDir, 'clone'), {
        // A depth past INT_MAX makes clone probe Git's integer conversion.
        depth: 2 ** 31,
        config: { 'core.sshCommand': `touch ${marker}` } as CloneConfig,
      }),
    ).rejects.toBeInstanceOf(GitArgumentError);
    expect(spawned).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  it('writes accepted keys into the new repository', async () => {
    const destination = join(tempDir, 'clone');
    const repo = (await git.clone(upstream, destination, {
      config: {
        'user.name': 'Clone User',
        'HTTP.ExtraHeader': 'X-Test: 1',
        'http.https://example.com/.sslVerify': 'false',
      } as CloneConfig,
    })) as WorktreeRepo;
    expect(await repo.config.getRaw('user.name')).toBe('Clone User');
    expect(await repo.config.getRaw('http.extraheader')).toBe('X-Test: 1');
    expect(await repo.config.getRaw('http.https://example.com/.sslverify')).toBe('false');
  });
});
