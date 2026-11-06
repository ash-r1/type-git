import type { Git } from '../../src/core/git.js';
import type { BareRepo, StatusPorcelain, WorktreeRepo } from '../../src/core/repo.js';
import type { RawResult } from '../../src/core/types.js';
import type { TypeGit } from '../../src/adapters/node/index.js';
import { strict, type Strict, type StrictGit, type StrictWorktreeRepo } from '../../src/strict/index.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Check<T extends true> = T;

export async function strictEntry(git: Git, client: TypeGit, repo: WorktreeRepo, bare: BareRepo): Promise<void> {
  // strict() keeps every original member and adds command().
  const strictRepo = strict(repo);
  const status: StatusPorcelain = await strictRepo.status();
  void status;
  const log: RawResult = await strictRepo.command('log', [['--oneline'], ['-n', '5']]);
  void log;
  const bytes: RawResult<Uint8Array> = await strict(bare).command('cat-file', [['-p'], { operand: 'HEAD' }], {
    stdout: 'bytes',
  });
  void bytes;
  const version: RawResult = await strict(client).command('version', []);
  void version;
  // @ts-expect-error grammar checks still apply through strict()
  await strictRepo.command('log', [['--no-such-option']]);
  const sameGit: StrictGit = strict(git);
  void sameGit;
  const sameRepo: StrictWorktreeRepo = strictRepo;
  void sameRepo;
}

export type StrictEntryCases = [
  Check<Equal<ReturnType<typeof strict<WorktreeRepo>>, Strict<WorktreeRepo>>>,
];
