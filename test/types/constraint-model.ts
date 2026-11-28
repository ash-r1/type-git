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
  // @ts-expect-error A recursive clone cannot use both reference kinds.
  await git.clone('source', 'destination', { recurseSubmodules: true, reference: 'a', referenceIfAble: 'b' });
  await git.clone('source', 'destination', { reference: 'a', referenceIfAble: 'b' });
  await repo.fetch({ depth: 1, deepen: 0 });
  // @ts-expect-error Nonzero deepen cannot be combined with depth.
  await repo.fetch({ depth: 1, deepen: 2 });
  await repo.push({ remote: 'origin', deleteRefs: true, refspec: 'obsolete' });
  // @ts-expect-error Git reads the first positional word as the repository.
  await repo.push({ deleteRefs: true, refspec: 'obsolete' });
  // @ts-expect-error repo.fetch reads the first positional word as the repository as well.
  await repo.fetch({ refspec: 'main' });
  await repo.fetch({ remote: 'origin', refspec: ['tag', 'v1'] });
  // @ts-expect-error The tag shorthand must expand to a valid refspec.
  await repo.fetch({ remote: 'origin', refspec: ['tag', ''] });
  // @ts-expect-error A deleted name must be a valid ref name.
  await repo.push({ remote: 'origin', deleteRefs: true, refspec: 'bad name' });
  // @ts-expect-error repo.pull reads the first positional word as the repository too.
  await repo.pull({ branch: 'main' });
  // @ts-expect-error Fetching from all remotes cannot name a repository.
  await repo.pull({ all: true, remote: 'origin' });
  await repo.pull({ remote: 'origin', branch: 'main' });
  // @ts-expect-error Deletion needs refs.
  await repo.push({ deleteRefs: true });
  // @ts-expect-error Delete and bulk push modes conflict.
  await repo.push({ deleteRefs: true, refspec: 'obsolete', tags: true });
  await repo.cherryPick([], { continue: true, cleanup: 'strip' });
  // @ts-expect-error Even the false rerere form is a command argument forbidden in control mode.
  await repo.cherryPick([], { continue: true, rerereAutoupdate: false });
  // @ts-expect-error Mainline is forbidden with sequencer control operations.
  await repo.revert([], { abort: true, mainline: 1 });
  // @ts-expect-error Git prints usage when a rebase action has any other argument.
  await repo.rebase({ abort: true, quiet: true });
  await repo.rebase({ abort: true });
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
  // @ts-expect-error repo.commit emits no paths, so include mode needs a pathspec file.
  await repo.commit({ message: 'm', include: true });
  await repo.commit({ message: 'm', include: true, pathspecFromFile: 'paths' });
  // Only mode without paths is a runtime check in repo.commit; see commitPaths.
  await repo.commit({ message: 'm', only: true, amend: false });
  await repo.commit({ message: 'm', only: true, allowEmpty: true });
  await repo.commit({ message: 'm', only: true, amend: true });
  await repo.commit({ message: 'm', only: true, pathspecFromFile: 'paths' });
  // An amend: fixup implies allowEmpty.
  await repo.commit({ only: true, fixup: 'amend:HEAD' });
  await repo.diff(undefined, { nameOnly: true, context: 2, patch: true, stat: true });
  // @ts-expect-error Git rejects these two name output modes, even though it accepts patches with either.
  await repo.diff(undefined, { nameOnly: true, nameStatus: true });
}
