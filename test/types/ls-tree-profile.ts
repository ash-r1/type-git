import type { Git } from '../../src/index.js';
import type { CheckedCommandArguments } from '../../src/commands/types.js';
declare const git: Git;
git.command('ls-tree', [['--help-all']]);
git.command('ls-tree', [['--git-completion-helper']]);
git.command('ls-tree', [['--git-completion-helper-all']]);
git.command('ls-tree', [['-h'], ['--abbrev', 'bad']]);
git.command('ls-tree', [['--long'], ['--name-only'], ['-h']]);
git.command('ls-tree', [['--name-only'], ['--name-status'], ['--help-all']]);
git.command('ls-tree', [['-h'], ['--long'], ['--name-only'], ['--object-only']]);
git.command('ls-tree', [['--full-tree'], ['--help']]);
git.command('ls-tree', [['--help-all'], ['--'], { operand: '-h' }]);
// @ts-expect-error A reached malformed abbreviation remains invalid.
git.command('ls-tree', [['--abbrev', 'bad'], ['-h']]);
// @ts-expect-error Legacy relaxation requires a real help exit.
git.command('ls-tree', [['--long'], ['--name-only'], { operand: 'HEAD' }]);
// @ts-expect-error Modern-only object mode cannot borrow the old bit-mode family.
git.command('ls-tree', [['--long'], ['--object-only'], ['-h']]);
// @ts-expect-error A newer-only format cannot be mixed with legacy-only mode acceptance.
git.command('ls-tree', [['--long'], ['--name-only'], ['--format', '%(path)'], ['-h']]);
// @ts-expect-error Required help-looking values do not create an exit.
git.command('ls-tree', [['--format', '-h'], ['--abbrev', 'bad']]);
// @ts-expect-error Reached multiword completion remains invalid.
git.command('ls-tree', [['--git-completion-helper'], ['--help-all']]);
// @ts-expect-error Shape constraints remain after help.
git.command('ls-tree', [['-h'], ['--long', true]]);
// @ts-expect-error NUL remains impossible after help.
git.command('ls-tree', [['-h'], { operand: '\0' }]);
declare const lsTreeMaybeHelp: '-h' | '--full-tree';
// @ts-expect-error The non-help union arm still reaches the malformed callback.
git.command('ls-tree', [[lsTreeMaybeHelp], ['--abbrev', 'bad']]);
declare const lsTreeMixedMode: '--long' | '--object-only';
// @ts-expect-error Both modern mode arms conflict; the old alternative cannot lose the newer-only arm.
git.command('ls-tree', [[lsTreeMixedMode], ['--name-only'], ['-h']]);
git.command('ls-tree', [['--long'], { operand: 'HEAD' }]);
type Assert<T extends true> = T;
type Equal<A,B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type OldModes = readonly [readonly ['--long'], readonly ['--name-only'], readonly ['-h']];
type OrdinaryLong = readonly [readonly ['--long'], {readonly operand:'HEAD'}];
type OldModesWithoutHelp = readonly [readonly ['--long'], readonly ['--name-only'], {readonly operand:'HEAD'}];
export type LsTreeModePins = readonly [
 Assert<Equal<CheckedCommandArguments<'ls-tree', OrdinaryLong, {lsTreeModes:'bits'}>, OrdinaryLong>>,
 Assert<Equal<CheckedCommandArguments<'ls-tree', OrdinaryLong, {lsTreeModes:'cmdmode'}>, OrdinaryLong>>,
 Assert<Equal<CheckedCommandArguments<'ls-tree', OldModesWithoutHelp, {lsTreeModes:'bits'}>, never>>,
 Assert<Equal<CheckedCommandArguments<'ls-tree', OldModes, {lsTreeModes:'bits'}>, OldModes>>,
 Assert<Equal<CheckedCommandArguments<'ls-tree', OldModes, {lsTreeModes:'cmdmode'}>, never>>
];
