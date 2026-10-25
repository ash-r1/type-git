import type { Git } from '../../src/index.js';
import type { CheckedCommandArguments } from '../../src/commands/types.js';
declare const git: Git;
git.command('read-tree', [['--exclude-per-directory', 'other'], ['-h']]);
git.command('read-tree', [['--exclude-per-directory', ''], ['-u'], ['--help-all']]);
git.command('read-tree', [['-u'], ['--exclude-per-directory', '.gitignore'], ['--exclude-per-directory', '.gitignore'], ['-h']]);
// @ts-expect-error Legacy relaxation cannot admit a non-string option value.
git.command('read-tree', [['--exclude-per-directory', true], ['-h']]);
// @ts-expect-error A required value resembling help is not an exit.
git.command('read-tree', [['--exclude-per-directory', '-h']]);
// @ts-expect-error NUL cannot occur in serialized argv.
git.command('read-tree', [['--exclude-per-directory', '\0'], ['-h']]);
declare const unsafeFlag: '--exclude-per-directory' | '-u';
// @ts-expect-error The value-bearing -u union arm remains invalid despite another valid legacy arm.
git.command('read-tree', [[unsafeFlag, 'other'], ['-h']]);
// Old callbacks accept arbitrary filenames and check -u after parsing.
git.command('read-tree', [['--dry-run'], ['--exclude-per-directory', 'other'], ['-m'], { operand: 'HEAD' }, ['-u']]);
git.command('read-tree', [['--dry-run'], ['-u'], ['--exclude-per-directory', ''], ['--reset'], { operand: 'HEAD' }]);
// @ts-expect-error Neither parser family accepts a non-help callback without -u.
git.command('read-tree', [['--dry-run'], ['--exclude-per-directory', 'other'], ['-m'], { operand: 'HEAD' }]);
// @ts-expect-error Arbitrary filenames require the legacy family, which rejects repetition.
git.command('read-tree', [['--dry-run'], ['-u'], ['--exclude-per-directory', 'other'], ['--exclude-per-directory', '.gitignore'], ['-m'], { operand: 'HEAD' }]);
declare const maybeUpdate: '-u' | '--dry-run';
// @ts-expect-error The dry-run union arm lacks the legacy final update prerequisite.
git.command('read-tree', [['--exclude-per-directory', 'other'], [maybeUpdate], ['-m'], { operand: 'HEAD' }]);
type Assert<T extends true> = T;
type Equal<A,B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Old = readonly [readonly ['--exclude-per-directory', 'other'], readonly ['-h']];
type Duplicate = readonly [readonly ['-u'], readonly ['--exclude-per-directory', '.gitignore'], readonly ['--exclude-per-directory', '.gitignore'], readonly ['-h']];
type LateUpdate = readonly [readonly ['--dry-run'], readonly ['--exclude-per-directory', 'other'], readonly ['-m'], { readonly operand: 'HEAD' }, readonly ['-u']];
type MissingUpdate = readonly [readonly ['--dry-run'], readonly ['--exclude-per-directory', 'other'], readonly ['-m'], { readonly operand: 'HEAD' }];
export type ReadTreeProfileCases = readonly [
 Assert<Equal<CheckedCommandArguments<'read-tree', LateUpdate, { readTreeExclude: 'legacy' }>, LateUpdate>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', LateUpdate, { readTreeExclude: 'modern' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', MissingUpdate, { readTreeExclude: 'legacy' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Old, { readTreeExclude: 'legacy' }>, Old>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Old, { readTreeExclude: 'modern' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Duplicate, { readTreeExclude: 'legacy' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Duplicate, { readTreeExclude: 'modern' }>, Duplicate>>
];
