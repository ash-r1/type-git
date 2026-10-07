import type { ResetOpts, StashPushOpts, TagCreateOpts, SubmoduleOpts, RemoteAddOpts, LfsCheckoutOpts, LfsLocksOpts } from '../../src/core/repo.js';
export const reset: ResetOpts = { intentToAdd: true };
// @ts-expect-error intent-to-add requires mixed reset
export const badReset: ResetOpts = { mode: 'hard', intentToAdd: true };
export const stash: StashPushOpts = { pathspecFromFile: 'paths', paths: [] };
// @ts-expect-error staged stash excludes untracked files
export const badStash: StashPushOpts = { staged: true, all: true };
// @ts-expect-error file and positional pathspecs conflict
export const badPaths: StashPushOpts = { pathspecFromFile: 'paths', paths: ['a'] };
// @ts-expect-error tag message sources conflict, including empty strings
export const badTag: TagCreateOpts = { message: '', file: 'message' };
export const update: SubmoduleOpts = { checkout: true, merge: true, rebase: true };
// @ts-expect-error filtering requires init
export const badUpdate: SubmoduleOpts = { filter: 'blob:none' };
export const remote: RemoteAddOpts = { mirror: 'fetch', track: 'main' };
// @ts-expect-error push mirrors cannot track branches
export const badRemote: RemoteAddOpts = { mirror: 'push', track: 'main' };
export const checkout: LfsCheckoutOpts = { ours: true, to: 'output' };
// @ts-expect-error conflict stage requires destination
export const badStage: LfsCheckoutOpts = { ours: true };
// @ts-expect-error destination requires conflict stage
export const badDestination: LfsCheckoutOpts = { to: 'output' };
// @ts-expect-error only one conflict stage
export const badStages: LfsCheckoutOpts = { to: 'output', base: true, ours: true };
// @ts-expect-error checkout does not have include option
export const badInclude: LfsCheckoutOpts = { include: '*.bin' };
export const locks: LfsLocksOpts = { cached: true, limit: 0, verify: true };
// @ts-expect-error cached and local are incompatible
export const badLocks: LfsLocksOpts = { cached: true, local: true };
// @ts-expect-error verification disallows filters
export const badFilter: LfsLocksOpts = { verify: true, path: 'file' };

import type { WorktreeRepo } from '../../src/core/repo.js';
declare const repo: WorktreeRepo;
repo.lfs.checkout(['file'], { ours: true, to: 'out' });
// @ts-expect-error conflict checkout requires one path
repo.lfs.checkout(['a', 'b'], { ours: true, to: 'out' });
// @ts-expect-error conflict checkout cannot omit the path
repo.lfs.checkout(undefined, { ours: true, to: 'out' });
repo.lfs.migrateImport({ noRewrite: true, files: ['file'], message: 'convert' });
// @ts-expect-error no-rewrite requires files
repo.lfs.migrateImport({ noRewrite: true });
// @ts-expect-error import does not support top
repo.lfs.migrateImport({ top: 1 });
// @ts-expect-error export requires include
repo.lfs.migrateExport();
// @ts-expect-error export does not support fixup
repo.lfs.migrateExport({ include: '*.bin', fixup: true });
