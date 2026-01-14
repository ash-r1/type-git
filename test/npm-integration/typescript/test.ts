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
