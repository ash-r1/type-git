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
type Assert<T extends true> = T;
type Equal<A,B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type Old = readonly [readonly ['--exclude-per-directory', 'other'], readonly ['-h']];
type Duplicate = readonly [readonly ['-u'], readonly ['--exclude-per-directory', '.gitignore'], readonly ['--exclude-per-directory', '.gitignore'], readonly ['-h']];
export type ReadTreeProfileCases = readonly [
 Assert<Equal<CheckedCommandArguments<'read-tree', Old, { readTreeExclude: 'legacy' }>, Old>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Old, { readTreeExclude: 'modern' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Duplicate, { readTreeExclude: 'legacy' }>, never>>,
 Assert<Equal<CheckedCommandArguments<'read-tree', Duplicate, { readTreeExclude: 'modern' }>, Duplicate>>
];
