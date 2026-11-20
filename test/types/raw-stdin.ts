import type { Git } from '../../src/core/git.js';
import type { BareRepo, WorktreeRepo } from '../../src/core/repo.js';
export async function rawStdin(git: Git, repo: WorktreeRepo, bare: BareRepo): Promise<void> {
  await git.raw(['hash-object', '--stdin'], { stdin: 'text' });
  await repo.raw(['hash-object', '--stdin'], { stdin: new Uint8Array([1]) });
  await bare.raw(['hash-object', '--stdin'], { stdin: 'text', env: { GIT_TRACE: '0' } });
  // @ts-expect-error stdin takes a string or Uint8Array
  await git.raw(['hash-object', '--stdin'], { stdin: 1 });
}
