/**
 * TypeScript Type Definition Integration Test
 *
 * Verifies that type definitions are correctly exported and resolve properly.
 * This file is only type-checked (tsc --noEmit), not executed.
 */

// Test 1: Main entry point types
import { createGit, type Git, type GitError, type RawResult } from 'type-git';

// Test 2: Node adapter types
import { TypeGit, createNodeAdapters } from 'type-git/node';

// Test 3: Bun adapter types
import { createBunAdapters } from 'type-git/bun';

// Test 4: Deno adapter types
import { createDenoAdapters } from 'type-git/deno';

// Type assertions to ensure types are correctly inferred
async function testTypes(): Promise<void> {
  // Test createGit function signature
  const adapters = createNodeAdapters();
  const git: Git = await createGit({ adapters });

  // Test Git interface methods
  const version: string = await git.version();
  console.log(version);

  // Public declarations retain ordered command validation after bundling.
  await git.command('log', [['--default', 'HEAD'], ['--format', '%s']]);
  await git.command('log', [['--max-count', -1], ['--max-count-oldest', 2]]);
  await git.command('diff', [['--name-only'], ['-s']]);
  await git.command('diff --no-index', [{ operand: 'left' }, { operand: 'right' }]);
  // @ts-expect-error The reverse order retains incompatible output bits.
  await git.command('diff', [['-s'], ['--name-only']]);
  // @ts-expect-error A later token cannot recover from an immediate parser rejection.
  await git.command('log', [['--max-count-oldest', 2], ['--skip', 0], ['--max-count', 1]]);

  await git.command('reflog show', [['--grep-reflog', 'pattern']]);
  await git.command('stash show', [['-S', 'needle'], ['-p']]);
  // @ts-expect-error Reflog mode is initialized before folding user options.
  await git.command('reflog show', [['--graph']]);

  await git.command('check-attr', [['--stdin'], { operand: 'text' }]);
  await git.command('ls-files', [['--format', '%(path)'], ['--unmerged']]);
  await git.command('for-each-ref', [['--start-after', 'refs/a'], ['--no-sort'], ['--sort', 'refname']]);
  // @ts-expect-error Explicit stage conflicts with format.
  await git.command('ls-files', [['--format', '%(path)'], ['--stage']]);
  // @ts-expect-error Branch shorthand takes no extra flags.
  await git.command('check-ref-format', [['--branch'], ['--normalize'], { operand: 'topic' }]);
  await git.command('am', [['--continue'], ['--resolved']]);
  await git.command('am', [['--show-current-patch'], ['--show-current-patch', 'raw']]);
  await git.command('apply', [['--3way'], ['--ours'], ['--theirs']]);
  // @ts-expect-error Callback values select conflicting native modes.
  await git.command('am', [['--show-current-patch', 'raw'], ['--show-current-patch', 'diff']]);
  // @ts-expect-error Three-way application cannot produce rejects.
  await git.command('apply', [['--3way'], ['--reject']]);
  await git.command('rebase', [['--empty', 'AsK'], { operand: 'HEAD' }]);
  await git.command('cherry-pick', [['--quit'], ['--quit'], ['-S']]);
  // @ts-expect-error Merge continuation uses original argument count.
  await git.command('merge', [['--quit'], ['--quit']]);
  // @ts-expect-error The two same-named C tables have different command scopes.
  await git.command('cherry-pick', [['--reference'], { operand: 'HEAD' }]);

  // Test raw method return type
  const rawResult: RawResult = await git.raw(['--version']);
  const _stdout: string = rawResult.stdout;
  const _stderr: string = rawResult.stderr;
  const _exitCode: number = rawResult.exitCode;

  // Test TypeGit class
  const typeGit = new TypeGit();
  const _gitVersion: string = await typeGit.version();

  // Test WorktreeRepo interface (from init)
  const repo = await typeGit.init('/tmp/test-repo');
  if ('workdir' in repo) {
    // WorktreeRepo
    const _workdir: string = repo.workdir;
    const status = await repo.status();
    const _entries: typeof status.entries = status.entries;

    // Test branch operations
    const branches = await repo.branch.list();
    const _branchName: string | undefined = branches[0]?.name;

    // Test log operations
    const logs = await repo.log();
    const _hash: string | undefined = logs[0]?.hash;
  }

  // Test adapters return correct structure
  const nodeAdapters = createNodeAdapters();
  console.log(nodeAdapters.exec, nodeAdapters.fs);

  const bunAdapters = createBunAdapters();
  console.log(bunAdapters.exec, bunAdapters.fs);

  const denoAdapters = createDenoAdapters();
  console.log(denoAdapters.exec, denoAdapters.fs);
}

// Test error types
function testErrorTypes(error: unknown): void {
  if (error instanceof Error) {
    const gitError = error as GitError;
    // GitError has kind, category, and context properties
    const _kind: string = gitError.kind;
    const _category: string = gitError.category;
    // argv and exitCode are in context
    const _argv: string[] | undefined = gitError.context.argv;
    const _exitCode: number | undefined = gitError.context.exitCode;
  }
}

// Export to prevent unused warnings
export { testTypes, testErrorTypes };
