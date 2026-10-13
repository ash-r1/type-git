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

export function testCompoundDecimalTypes(git: Git, dynamic: string): void {
  git.command('shortlog', [['-w', '-18446744073709551540'], ['-h']]);
  git.command('shortlog', [['-w', dynamic], ['-h']]);
  git.command('shortlog', [['-h'], ['-w', '76\n']]);
  git.command('show-branch', [['--reflog', '1,date\n'], ['-h']]);
  // @ts-expect-error Width must exceed both nonzero indentations.
  git.command('shortlog', [['-w', '9,0,9'], ['-h']]);
  // @ts-expect-error Numeric trailing newlines are not consumed by strtoul.
  git.command('show-branch', [['--reflog', '1\n'], ['-h']]);
  // @ts-expect-error This overflow saturates ULONG_MAX before the checked int conversion.
  git.command('shortlog', [['-w', '-18446744073709551616'], ['-h']]);
}

export function testPhasedParserExitTypes(git: Git, dynamic: string): void {
  git.command('log', [['--color', 'invalid'], ['-h']]);
  git.command('log', [['-n', '-h']]);
  git.command('log', [['--decorate', dynamic], ['-h']]);
  git.command('fast-export', [['--reencode', 'ABORT'], ['-h']]);
  // @ts-expect-error The initial callback runs before help.
  git.command('log', [['--decorate', 'invalid'], ['-h']]);
  // @ts-expect-error The split value is another initial-pass option, not opaque data.
  git.command('log', [['-n', '--decorate=invalid'], ['-h']]);
}

export function testStringCallbackTypes(git: Git, dynamic: string): void {
  git.command('fast-export', [['--anonymize-map', 'one:two:'], ['-h']]);
  git.command('fast-export', [['-h'], ['--anonymize-map', ':']]);
  git.command('fast-import', [['--signed-tags', 'sign-if-invalid=']]);
  git.command('fast-import', [['--signed-commits', dynamic]]);
  // @ts-expect-error The first separator leaves an empty key.
  git.command('fast-export', [['--anonymize-map', ':value'], ['-h']]);
  // @ts-expect-error Only sign-if-invalid accepts a key suffix.
  git.command('fast-import', [['--signed-tags', 'strip=key']]);
}

export function testResidualArgvTypes(git: Git): void {
  git.command('log', [['-n', '-L'], { operand: '1,1:file' }, { operand: '0' }]);
  git.command('log', [['--'], ['--color', 'invalid']]);
  git.command('fast-export', [['-G', '--'], ['-h']]);
  // @ts-expect-error -L consumes -h in the initial pass, leaving -G without a value.
  git.command('log', [['-G', '-L'], ['-h']]);
  // @ts-expect-error Fast-export drops the first -- and the next pass validates color.
  git.command('fast-export', [['--'], ['--color', 'invalid']]);
}

export function testReflogWrapperTypes(git: Git): void {
  git.command('reflog show', [['--decorate', 'invalid'], ['-h']]);
  git.command('reflog', [{ operand: 'show' }, ['-G', '-L'], ['-h']]);
  git.command('reflog show', [['--help'], ['--decorate', 'invalid']]);
  // @ts-expect-error The root wrapper delegates before reaching help.
  git.command('reflog', [['--decorate', 'invalid'], ['-h']]);
  // @ts-expect-error No wrapper help exit suppresses this invalid callback.
  git.command('reflog show', [['--decorate', 'invalid']]);
}

export function testFormatPatchParserTypes(git: Git): void {
  git.command('format-patch', [['-n'], ['-k'], ['-h']]);
  git.command('format-patch', [['--cover-from-description', 'invalid'], ['-h']]);
  git.command('format-patch', [['-h'], ['--thread', 'invalid']]);
  // @ts-expect-error The thread callback executes before help.
  git.command('format-patch', [['--thread', 'invalid'], ['-h']]);
  // @ts-expect-error Repeated directory callbacks execute before help.
  git.command('format-patch', [['-o', 'out'], ['-o', 'out'], ['-h']]);
}

export function testConditionalStashTypes(git: Git): void {
  git.command('stash list', [['--format', '%gs'], ['--max-count', '1']]);
  git.command('stash list', [['--color', 'invalid']]);
  git.command('stash', [{ operand: 'list' }, ['--graph']]);
  // @ts-expect-error Native unconditional typo detection precedes the ref gate.
  git.command('stash list', [{ operand: '-no-color' }]);
  // @ts-expect-error A help exit cannot serialize a NUL byte.
  git.command('stash list', [['-h'], ['--format', '\0']]);
}

export function testNativeStashParserTypes(git: Git): void {
  git.command('stash push', [['--unified', '-2'], ['-h']]);
  git.command('stash pop', [{ operand: '-qh' }]);
  git.command('stash apply', [{ operand: '--label-o=ours' }, ['-h']]);
  git.command('stash store', [{ operand: '--unknown' }, ['-h']]);
  git.command('stash save', [['--'], ['--unified', 'bad']]);
  // @ts-expect-error Clear stops parsing at the first operand.
  git.command('stash clear', [{ operand: 'file' }, ['-h']]);
  // @ts-expect-error Invalid integer callbacks execute before help.
  git.command('stash push', [['--unified', 'bad'], ['-h']]);
  // @ts-expect-error The long-name prefix is ambiguous.
  git.command('stash apply', [{ operand: '--label=ours' }, ['-h']]);
}

export function testAssumedStashTypes(git: Git): void {
  git.command('stash', [['--patch'], { operand: 'file' }, ['--unified', 'bad']]);
  git.command('stash', [['--'], ['--unified', 'bad']]);
  git.command('stash', [['--unified', '-2'], ['-h']]);
  git.command('reflog show', [{ operand: '-show' }, ['-h']]);
  // @ts-expect-error A separator after the first operand is a literal path.
  git.command('stash', [{ operand: 'file' }, ['--'], ['-h']]);
  // @ts-expect-error The initial wrapper catches the subcommand-name typo before help.
  git.command('reflog', [{ operand: '-sho' }, ['-h']]);
}

export function testStashTransferTypes(git: Git): void {
  git.command('stash import', [{ operand: 'one' }, { operand: 'two' }, ['-h']]);
  git.command('stash import', [['--']]);
  git.command('stash export', [['--print'], ['--to-ref', 'refs/exported'], ['-h']]);
  git.command('stash export', [{ operand: '--pri' }, ['-h']]);
  // @ts-expect-error -- is retained, so this has two operands.
  git.command('stash import', [['--'], ['-h']]);
  // @ts-expect-error Native command-mode flags cannot be negated.
  git.command('stash export', [{ operand: '--no-print' }, ['-h']]);
}

export function testStashShowPartitionTypes(git: Git): void {
  git.command('stash show', [['--color', 'bad'], ['-h']]);
  git.command('stash show', [['--'], ['--default', 'foo']]);
  git.command('stash show', [['--'], ['-h'], { operand: '-unknown' }]);
  // @ts-expect-error Plain words after -- still count as stash references.
  git.command('stash show', [['--'], { operand: 'foo' }, { operand: 'one' }]);
  // @ts-expect-error The native own-table flag is processed before help.
  git.command('stash show', [{ operand: '--include-untracked=1' }, ['-h']]);
}

export function testWorktreeParserTypes(git: Git): void {
  git.command('add', [{ operand: '--dry-r' }, ['-h']]);
  git.command('rm', [{ operand: '-nh' }]);
  git.command('mv', [['--'], { operand: 'file' }, ['-h']]);
  git.command('clean', [{ operand: '-nq' }]);
  // @ts-expect-error A consumed marker leaves one path, not help.
  git.command('mv', [['--'], ['-h']]);
  // @ts-expect-error Flags reject attached data before later help.
  git.command('rm', [{ operand: '--quiet=1' }, ['-h']]);
}

export function testReferenceParserTypes(git: Git): void {
  git.command('branch', [['--contains']]);
  git.command('tag', [['--column', 'never,row'], ['-n', '0']]);
  git.command('status', [['--untracked-files', '-1']]);
  git.command('commit', [['--cleanup', 'bad'], ['-h']]);
  // @ts-expect-error LASTARG_DEFAULT consumes -h before the invalid color callback.
  git.command('branch', [['--contains'], ['-h'], ['--color', 'bad']]);
  // @ts-expect-error Explicit column mode conflicts with requested lines.
  git.command('tag', [['--column', 'row'], ['-n', '0']]);
  // @ts-expect-error Git false-valued spellings suppress untracked files.
  git.command('status', [['--ignored', 'matching'], ['--untracked-files', 'OFF']]);
  // @ts-expect-error Invalid cleanup is rejected even in dry-run mode.
  git.command('commit', [['--dry-run'], ['--cleanup', 'bad']]);
}

export function testCheckoutParserTypes(git: Git): void {
  git.command('switch', [{ operand: '--det' }, ['-h']]);
  git.command('restore', [['--'], ['-h']]);
  git.command('reset', [{ operand: 'file' }, { operand: 'other' }, ['--'], ['-h']]);
  git.command('checkout', [['--'], ['--'], ['-h']]);
  // @ts-expect-error Checkout scans the retained stream and allows only one reference before --.
  git.command('checkout', [{ operand: 'file' }, { operand: 'other' }, ['--'], ['-h']]);
  // @ts-expect-error Hard reset cannot update explicitly separated paths.
  git.command('reset', [['--hard'], ['--'], ['-h']]);
  // @ts-expect-error Detached checkout cannot update explicitly separated paths.
  git.command('checkout', [['--detach'], ['--'], ['-h']]);
}

export function testAliasParserTypes(git: Git): void {
  git.command('clone', [{ operand: '--recur' }, ['-h']]);
  git.command('fetch', [{ operand: '--negotiation-t=HEAD' }, ['-h']]);
  git.command('push', [{ operand: '--bra' }, ['-h']]);
  git.command('clone', [['--'], { operand: 'remote.git' }, ['-h']]);
  // @ts-expect-error A native alias preserves its target's no-value flag grammar.
  git.command('push', [{ operand: '--branches=1' }, ['-h']]);
  // @ts-expect-error Literal -h after -- cannot suppress clone's final arity check.
  git.command('clone', [['--'], { operand: 'one' }, { operand: 'two' }, ['-h']]);
}
