/** `raw()` writes `stdin` to the command's standard input on every client type. */

import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { Git } from '../core/git.js';
import type { BareRepo, WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { createGit } from './git-impl.js';

const USE_LEGACY_VERSION: boolean = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

/** Object ID Git assigns to a blob, computed by Git itself. */
function blobId(content: string): string {
  return execFileSync('git', ['hash-object', '--stdin'], { input: content }).toString().trim();
}

describe('raw() stdin', () => {
  let git: Git;
  let tempDir: string;
  let repo: WorktreeRepo;
  let bare: BareRepo;

  beforeAll(async () => {
    git = await createGit({ adapters: createNodeAdapters(), useLegacyVersion: USE_LEGACY_VERSION });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-raw-stdin-'));
    repo = (await git.init(join(tempDir, 'work'))) as WorktreeRepo;
    bare = (await git.init(join(tempDir, 'bare.git'), { bare: true })) as BareRepo;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('passes a string to Git.raw', async () => {
    const result = await git.raw(['hash-object', '--stdin'], { stdin: 'hello\n' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(blobId('hello\n'));
  });

  it('passes bytes unchanged to WorktreeRepo.raw and writes the object', async () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x0a, 0x80]);
    const result = await repo.raw(['hash-object', '-w', '--stdin'], { stdin: bytes });
    expect(result.exitCode).toBe(0);
    const id = result.stdout.trim();
    expect(id).toBe(
      execFileSync('git', ['hash-object', '--stdin'], { input: Buffer.from(bytes) })
        .toString()
        .trim(),
    );
    const size = await repo.raw(['cat-file', '-s', id]);
    expect(size.stdout.trim()).toBe('4');
  });

  it('passes a string to BareRepo.raw', async () => {
    const result = await bare.raw(['hash-object', '-w', '--stdin'], { stdin: 'bare\n' });
    expect(result.exitCode).toBe(0);
    const content = await bare.raw(['cat-file', '-p', result.stdout.trim()]);
    expect(content.stdout).toBe('bare\n');
  });

  it('gives an empty standard input when stdin is omitted', async () => {
    const result = await git.raw(['hash-object', '--stdin']);
    expect(result.stdout.trim()).toBe(blobId(''));
  });

  it('refuses a stdin value that is neither a string nor a Uint8Array', async () => {
    await expect(
      git.raw(['hash-object', '--stdin'], { stdin: 42 as unknown as string }),
    ).rejects.toBeInstanceOf(GitArgumentError);
  });
});
