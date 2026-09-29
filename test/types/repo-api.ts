import { expectTypeOf } from 'vitest';
import type { Git } from '../../src/core/git.js';
import type { BareRepo, WorktreeRepo } from '../../src/core/repo.js';

// Compile only: these assertions and expected errors are checked by test:types.
export async function checkRepositoryTypes(git: Git): Promise<void> {
  expectTypeOf(await git.init('/path')).toEqualTypeOf<WorktreeRepo>();
  expectTypeOf(await git.init('/path', { bare: true })).toEqualTypeOf<BareRepo>();
  expectTypeOf(await git.clone('url', '/path')).toEqualTypeOf<WorktreeRepo>();
  expectTypeOf(await git.clone('url', '/path', { bare: true })).toEqualTypeOf<BareRepo>();
  expectTypeOf(await git.clone('url', '/path', { mirror: true })).toEqualTypeOf<BareRepo>();
  expectTypeOf(await git.open('/path')).toEqualTypeOf<WorktreeRepo>();
  expectTypeOf(await git.openBare('/path')).toEqualTypeOf<BareRepo>();

  const repo = await git.openRaw('/path');
  expectTypeOf(repo).toEqualTypeOf<WorktreeRepo | BareRepo>();
  if ('workdir' in repo) {
    expectTypeOf(repo).toEqualTypeOf<WorktreeRepo>();
  } else {
    expectTypeOf(repo).toEqualTypeOf<BareRepo>();
  }

  const bare = await git.init('/path', { bare: true });
  // @ts-expect-error Bare repositories do not expose a working directory.
  bare.workdir;
  // @ts-expect-error Status requires a working tree.
  await bare.status();
  // @ts-expect-error Staging files requires a working tree.
  await bare.add('file.txt');
  // @ts-expect-error Repository operations are unavailable on the Git factory.
  await git.status();
}
