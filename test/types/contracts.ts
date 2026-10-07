import type { Git, CloneOpts, InitOpts } from '../../src/core/git.js';
import type { WorktreeRepo, BareRepo, LsTreeEntry, LsTreeOpts, DiffResult, DiffOpts, ConfigGetOpts } from '../../src/core/repo.js';
import type { TypeGit as NodeGit } from '../../src/adapters/node/index.js';
import type { TypeGit as BunGit } from '../../src/adapters/bun/index.js';
import type { TypeGit as DenoGit } from '../../src/adapters/deno/index.js';

function expectType<T>(_value: T): void {}

/** Compiled by tsc in CI, never executed. @ts-expect-error must correspond to a real error. */
export async function contracts(git: Git, repo: WorktreeRepo, bare: BareRepo, flag: boolean, cloneOpts: CloneOpts, initOpts: InitOpts, treeOpts: LsTreeOpts, diffOpts: DiffOpts, configOpts: ConfigGetOpts): Promise<void> {
  expectType<WorktreeRepo>(await git.init('path'));
  expectType<BareRepo>(await git.init('path', { bare: true }));
  expectType<WorktreeRepo | BareRepo>(await git.init('path', initOpts));
  const dynamic = await git.clone('url', 'path', { bare: flag });
  // @ts-expect-error Dynamic bare flags cannot guarantee a working tree.
  dynamic.status();
  if (dynamic.kind === 'worktree') expectType<WorktreeRepo>(dynamic);
  else expectType<BareRepo>(dynamic);
  expectType<WorktreeRepo | BareRepo>(await git.clone('url', 'path', cloneOpts));
  expectType<BareRepo>(await git.clone('url', 'path', { mirror: true }));
  expectType<WorktreeRepo>(await git.clone('url', 'path', { bare: false, mirror: false }));
  expectType<LsTreeEntry[]>(await repo.lsTree('HEAD'));
  expectType<string[]>(await repo.lsTree('HEAD', { nameOnly: true }));
  expectType<string[]>(await bare.lsTree('HEAD', { objectOnly: true }));
  expectType<LsTreeEntry[] | string[]>(await bare.lsTree('HEAD', treeOpts));
  expectType<DiffResult>(await repo.diff());
  expectType<string[]>(await repo.diff('HEAD', { nameOnly: true }));
  expectType<DiffResult | string[]>(await repo.diff('HEAD', diffOpts));
  expectType<string | undefined>(await repo.config.getRaw('user.name'));
  expectType<string[]>(await bare.config.getRaw('test.multi', { all: true }));
  expectType<string | string[] | undefined>(await git.config.getRaw('test.multi', configOpts));
  expectType<boolean>(await repo.revParse({ isBareRepository: true }));
  expectType<string[]>(await bare.revParse({ branches: true }));
  expectType<string>(await repo.revParse({ gitDir: true }));
  await repo.fetch({ ipv4: flag, ipv6: false });
  await repo.lfs.push({ objectId: ['oid'], stdin: true });
  await repo.add([], { pathspecFromFile: 'paths.txt' });
  await repo.restore([], { pathspecFromFile: 'paths.txt' });
  // @ts-expect-error Git forbids mixing command-line paths and pathspec files.
  await repo.add(['file'], { pathspecFromFile: 'paths.txt' });
  // @ts-expect-error Checkout pathspec files are also a separate input mode.
  await repo.checkout(['file'], { pathspecFromFile: 'paths.txt' });
  // Git accepts this combination; serialization preserves its semantics.
  await git.clone('url', 'path', { ipv4: true, ipv6: true });
  // @ts-expect-error Conflicting repository layout.
  await git.init('path', { bare: true, separateGitDir: 'other' });
  // @ts-expect-error URL output is not a ref list.
  await git.lsRemote('url', { getUrl: true });
  // @ts-expect-error Symbolic refs are not object hashes.
  await repo.lsRemote('origin', { symref: true });
  // @ts-expect-error Exclusive tree modes, also when passed via a variable.
  const invalidTree: LsTreeOpts = { nameOnly: true, objectOnly: true };
  expectType<unknown>(invalidTree);
  // @ts-expect-error Only porcelain v2 is parsed.
  await repo.status({ porcelain: 1 });
  // @ts-expect-error Encoding belongs to the typed API.
  await repo.status({ nullTerminated: false });
  // @ts-expect-error Stats cannot be parsed as commits.
  await repo.log({ stat: true });
  // Git accepts this combination; serialization preserves its semantics.
  await repo.log({ merges: true, noMerges: true });
  // @ts-expect-error No remote is accepted for fetch --all.
  await repo.fetch({ all: true, remote: 'origin' });
  // @ts-expect-error Conflicting shallow controls.
  await bare.fetch({ depth: 1, unshallow: true });
  // Git accepts this combination; serialization preserves its semantics.
  await bare.push({ force: true, forceWithLease: true });
  // @ts-expect-error --all cannot take refspecs.
  await repo.push({ all: true, refspec: 'main' });
  // @ts-expect-error A dry run cannot yield a newly created commit.
  await repo.commit({ message: 'test', dryRun: true });
  // @ts-expect-error Conflicting message sources.
  await repo.commit({ message: 'test', file: 'message.txt' });
  // Git gives name-only output precedence over patch output.
  await repo.diff('HEAD', { nameOnly: true, patch: true });
  // @ts-expect-error Merge-base is a flag, not a string-valued option.
  await repo.diff('HEAD', { mergeBase: 'main' });
  // @ts-expect-error Exclusive checkout modes.
  await repo.checkout('new', { createBranch: true, detach: true });
  // Git accepts this combination; serialization preserves its semantics.
  await repo.checkout(['file'], { ours: true, theirs: true });
  // @ts-expect-error Cannot select conflict stages from a tree.
  await repo.restore(['file'], { source: 'HEAD', ours: true });
  // @ts-expect-error Mutually exclusive sequencer operations.
  await repo.rebase({ abort: true, continue: true });
  // Git accepts this combination; serialization preserves its semantics.
  await repo.rebase({ abort: true, upstream: 'main' });
  // @ts-expect-error Revert has no --no-verify flag.
  await repo.revert('HEAD', { noVerify: true });
  // @ts-expect-error A query union must reject two path queries.
  await repo.revParse({ gitDir: true, showToplevel: true });
  // @ts-expect-error A query cannot mix return types.
  await bare.revParse({ gitDir: true, isBareRepository: true });
  // @ts-expect-error config --get-all has no default mode.
  await repo.config.getRaw('test.key', { all: true, default: 'fallback' });
  // @ts-expect-error No invented values for names-only config output.
  await repo.config.list({ nameOnly: true });
  // @ts-expect-error LFS refs and object IDs are distinct modes.
  await repo.lfs.push({ ref: 'main', objectId: 'oid' });
  // @ts-expect-error LFS --all does not support filtering.
  await repo.lfs.fetch({ all: true, include: '*.bin' });
}

export async function runtimeEntrypoints(node: NodeGit, bun: BunGit, deno: DenoGit, flag: boolean): Promise<void> {
  for (const git of [node, bun, deno]) {
    expectType<WorktreeRepo>(await git.init('path'));
    expectType<BareRepo>(await git.clone('url', 'path', { mirror: true }));
    const dynamic = await git.init('path', { bare: flag });
    // @ts-expect-error All entrypoints must preserve the dynamic union.
    expectType<WorktreeRepo>(dynamic);
  }
}
