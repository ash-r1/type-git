import type { Git } from '../../src/core/git.js';
import type { WorktreeRepo } from '../../src/core/repo.js';

export async function checkConstraintModel(git: Git, repo: WorktreeRepo, flag: boolean): Promise<void> {
  await git.clone('source', 'destination', { alsoFilterSubmodules: true, filter: 'blob:none', recurseSubmodules: true });
  await git.clone('source', 'destination', { alsoFilterSubmodules: false });
  await git.clone('source', 'destination', { alsoFilterSubmodules: flag, filter: 'blob:none', recurseSubmodules: true });
  // @ts-expect-error Submodule filtering needs a filter, even with recursion enabled.
  await git.clone('source', 'destination', { alsoFilterSubmodules: true, recurseSubmodules: true });
  // @ts-expect-error Explicit false does not satisfy the recursion prerequisite.
  await git.clone('source', 'destination', { alsoFilterSubmodules: true, filter: 'blob:none', recurseSubmodules: false });
  await repo.fetch({ depth: 1, deepen: 0 });
  // @ts-expect-error Nonzero deepen cannot be combined with depth.
  await repo.fetch({ depth: 1, deepen: 2 });
  await repo.push({ deleteRefs: true, refspec: 'obsolete' });
  // @ts-expect-error Deletion needs refs.
  await repo.push({ deleteRefs: true });
  // @ts-expect-error Delete and bulk push modes conflict.
  await repo.push({ deleteRefs: true, refspec: 'obsolete', tags: true });
  await repo.cherryPick([], { continue: true, cleanup: 'strip' });
  // @ts-expect-error Even the false rerere form is a command argument forbidden in control mode.
  await repo.cherryPick([], { continue: true, rerereAutoupdate: false });
  // @ts-expect-error Mainline is forbidden with sequencer control operations.
  await repo.revert([], { abort: true, mainline: 1 });
  await repo.rebase({ abort: true, quiet: true });
  // @ts-expect-error Git merge control operations do not accept extra command arguments.
  await repo.merge('', { abort: true, ff: false });
  // @ts-expect-error Squash cannot be combined with explicitly disabling fast-forward.
  await repo.merge('branch', { squash: true, ff: false });
  // @ts-expect-error The string form of no-ff has the same constraint.
  await repo.merge('branch', { squash: true, ff: 'no' });
  // @ts-expect-error Orphan worktrees cannot disable checkout.
  await repo.worktree.add('path', { orphan: true, checkout: false });
  // @ts-expect-error Git does not combine an explicit author and author reset.
  await repo.commit({ author: 'Test <test@example.com>', resetAuthor: true });
  // @ts-expect-error Git does not combine file input and a fixup message source.
  await repo.commit({ file: 'message', fixup: 'HEAD' });
  await repo.commit({ message: 'extra', fixup: 'HEAD' });
  await repo.diff(undefined, { nameOnly: true, context: 2, patch: true, stat: true });
  // @ts-expect-error Git rejects these two name output modes, even though it accepts patches with either.
  await repo.diff(undefined, { nameOnly: true, nameStatus: true });
}
