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

  await git.command('update-index', [['-z'], ['--stdin']]);
  await git.command('update-index', [['--again'], { operand: '--refresh' }]);
  // @ts-expect-error Stdin callbacks require the last argument even after declaration bundling.
  await git.command('update-index', [['--stdin'], ['-z']]);
  // @ts-expect-error Again consumes subsequent words literally.
  await git.command('update-index', [['--again'], ['--refresh']]);
  // @ts-expect-error Relational equality remains available through packaged declarations.
  await git.command('bisect start', [['--term-good', 'same'], ['--term-bad', 'same']]);

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
function testNumericCommandTypes(git: Git, count: number): void {
  git.command('grep', [['-12'], { operand: 'pattern' }]);
  git.command('grep', [[`-${count}`], { operand: 'pattern' }]);
  git.command('archive', [['-123'], ['--list']]);
  // @ts-expect-error Numeric shorthand accepts decimal digits, not fractions.
  git.command('grep', [['-1.5'], { operand: 'pattern' }]);
  // @ts-expect-error Exponent notation is not a single numeric shorthand token.
  git.command('grep', [['-1e2'], { operand: 'pattern' }]);
  // @ts-expect-error Numeric shorthand is not available on arbitrary commands.
  git.command('version', [['-12']]);
}

export { testTypes, testErrorTypes, testNumericCommandTypes };

export function testFallbackCommandTypes(git: Git): void {
  git.command('config', [{ operand: 'get' }, ['--all'], { operand: 'test.key' }]);
  // @ts-expect-error Root dispatch must retain the child's conflicting option rule.
  git.command('config', [{ operand: 'get' }, ['--all'], ['--default', ''], { operand: 'test.key' }]);
  // @ts-expect-error Child-only options are unavailable before root dispatch.
  git.command('config', [['--append'], { operand: 'test.key' }, { operand: 'v' }]);
  git.command('config', [['--edit'], { operand: 'ignored' }]);
  // @ts-expect-error Modern edit has a different operand contract.
  git.command('config', [{ operand: 'edit' }, { operand: 'ignored' }]);
  git.command('stash', [{ operand: 'push' }, { operand: 'path' }]);
  // @ts-expect-error Implicit push requires a separator before a path.
  git.command('stash', [{ operand: 'path' }]);
}

export function testNativeIntegerTypes(git: Git, mixed: 1 | 2147483648): void {
  git.command('column', [['--width', '  +010k'], ['-h']]);
  git.command('pack-objects', [['--max-pack-size', 18446744073709551615n], ['-h']]);
  git.command('pack-objects', [['--max-pack-size', '0x0'], ['--stdout']]);
  // @ts-expect-error Native signed storage overflows before help.
  git.command('column', [['--width', 2147483648], ['-h']]);
  // @ts-expect-error An invalid member of a literal union is not a valid numeric argument.
  git.command('column', [['--width', mixed], ['-h']]);
  // @ts-expect-error Unicode Kelvin sign is not Git's ASCII k unit.
  git.command('column', [['--width', '1K'], ['-h']]);
  // @ts-expect-error A nonzero normalized value conflicts with stdout.
  git.command('pack-objects', [['--max-pack-size', '0b1k'], ['--stdout']]);
}

export function testNumericCallbackTypes(git: Git): void {
  git.command('describe', [['--abbrev', '2147483648'], ['--long']]);
  git.command('cherry-pick', [['--mainline', '-4294967295'], ['-h']]);
  git.command('grep', [['-9223372036854775808'], { operand: 'needle' }]);
  git.command('diff-files', [['-U', '']]);
  // @ts-expect-error Narrowing a multiple of 2^32 produces zero before final combination checks.
  git.command('describe', [['--abbrev', '4294967296'], ['--long']]);
  // @ts-expect-error Mainline must be positive after C conversion, not before it.
  git.command('cherry-pick', [['--mainline', '2147483648'], ['-h']]);
  // @ts-expect-error Decimal callbacks do not parse native integer k/m/g units.
  git.command('rev-list', [['--max-count', '1k'], ['--all']]);
}

export function testObjectFilterByteTypes(git: Git, dynamicCount: number): void {
  git.command('fetch', [['--filter', `tree:${dynamicCount}`]]);
  git.command('fetch', [['--filter', 'tree:18446744073709551615']]);
  git.command('fetch', [['--filter', 'combine:tree:%2b1']]);
  // @ts-expect-error Numeric unit multiplication overflows unsigned long.
  git.command('fetch', [['--filter', 'blob:limit=17179869184g']]);
  // @ts-expect-error Percent-encoded children must still satisfy their grammar.
  git.command('fetch', [['--filter', 'combine:tree:%ff']]);
  // @ts-expect-error Escaped separators are applied in the next nested combine stage.
  git.command('fetch', [['--filter', 'combine:combine:tree:1%2Bauto']]);
}

export function testArgvStringTypes(git: Git, dynamic: string): void {
  // @ts-expect-error Other dynamic tokens cannot erase a known NUL value.
  git.command('log', [['--format', 'a\0b'], { operand: dynamic }, ['-h']]);
  git.command('log', [['--format', 'text'], ['-h']]);
  // @ts-expect-error NUL cannot be serialized even when help suppresses Git semantic rules.
  git.command('log', [['--format', 'a\0b'], ['-h']]);
  // @ts-expect-error The same representation rule applies through command dispatch.
  git.command('config', [{ operand: 'get' }, { operand: 'a\0b' }]);
}

export function testParserExitTypes(git: Git, dynamic: string): void {
  git.command('branch', [['--color', 'AuTo'], ['-h']]);
  git.command('branch', [['-h'], ['--color', 'invalid'], ['--track', 'invalid']]);
  git.command('branch', [['--color', dynamic], ['-h']]);
  git.command('for-each-ref', [['-h'], ['--count', 'invalid']]);
  // @ts-expect-error The callback rejects invalid color before reaching help.
  git.command('branch', [['--color', 'invalid'], ['-h']]);
  // @ts-expect-error Config boolean synonyms do not belong to the color callback grammar.
  git.command('tag', [['--color', 'true']]);
  // @ts-expect-error Help cannot suppress the argv representation rule.
  git.command('show-branch', [['-h'], ['--color', 'a\0b']]);
}

export function testBooleanCallbackTypes(git: Git, dynamic: string): void {
  git.command('push', [['--signed', 'IF-ASKED'], ['-h']]);
  git.command('push', [['--signed', undefined], ['-h']]);
  git.command('fetch', [['--porcelain'], ['--recurse-submodules', '0k']]);
  git.command('fetch', [['--porcelain'], ['--recurse-submodules', dynamic]]);
  // @ts-expect-error Truthy values are not a push recursion mode.
  git.command('push', [['--recurse-submodules', '1k'], ['-h']]);
  // @ts-expect-error Numeric boolean input still has signed integer bounds.
  git.command('checkout', [['--recurse-submodules', '2147483648'], ['-h']]);
  // @ts-expect-error Unicode case folding differs from native ASCII matching.
  git.command('push', [['--signed', 'if-asKed'], ['-h']]);
  // @ts-expect-error Normalize numeric booleans before checking combinations.
  git.command('fetch', [['--porcelain'], ['--recurse-submodules', '1k']]);
}
