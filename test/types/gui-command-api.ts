import type { CheckedCommandArguments } from '../../src/commands/types.js';
import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('gui', []);
git.command('gui', [{ operand: 'citool' }, ['--amend'], ['--nocommit'], ['--commitmsg']]);
git.command('citool', [['--amend']]);
// @ts-expect-error No positional words remain in the commit UI.
git.command('citool', [{ operand: 'extra' }]);
git.command('gui browser', [{ operand: 'HEAD' }, ['--'], { operand: 'src' }]);
git.command('gui browser', [['--'], { operand: 'HEAD' }, { operand: 'src' }]);
git.command('gui blame', [['--line', 2], { operand: 'HEAD' }, ['--'], { operand: 'file' }]);
git.command('gui blame', [{ operand: 'HEAD' }, ['--line', 2], { operand: 'file' }]);
git.command('gui blame', [['--line', 2]]);
git.command('gui blame', [{ operand: '--line=2' }]);
git.command('gui', [['--version']]);
git.command('citool', [{ operand: 'version' }]);
// @ts-expect-error The shell version shortcut must occupy the entire argument string.
git.command('gui', [['--trace'], ['--version']]);
// @ts-expect-error GUI browser has no named --help option; use a literal operand for a filename.
git.command('gui browser', [['--help']]);

type Reject<T extends never> = T;
export type BadModernSeparator = Reject<CheckedCommandArguments<'gui browser', readonly [readonly ['--'], {readonly operand:'HEAD'}, {readonly operand:'src'}], {guiGrammar:'positional'}>>;
export type BadModernLineOrder = Reject<CheckedCommandArguments<'gui blame', readonly [{readonly operand:'HEAD'}, readonly ['--line',2], {readonly operand:'file'}], {guiGrammar:'positional'}>>;
export type OldExtraPaths = CheckedCommandArguments<'gui browser', readonly [readonly ['--'], {readonly operand:'HEAD'}, {readonly operand:'src'}], {guiGrammar:'path-loop'}>;

declare const opaqueGuiWord: string & {readonly __guiWord: unique symbol};
declare const possibleGui: 'gui' | typeof opaqueGuiWord;
git.command('gui', [{operand:possibleGui}]);
declare const invalidGuiAlternative: 'not-a-gui-operation' | typeof opaqueGuiWord;
// @ts-expect-error A known invalid operation remains invalid alongside an opaque alternative.
git.command('gui', [{operand:invalidGuiAlternative}]);

declare const possibleSeparator: '--' | typeof opaqueGuiWord;
type ModernMaybeSeparator = CheckedCommandArguments<'gui blame', readonly [{readonly operand:'HEAD'}, {readonly operand:typeof possibleSeparator}, {readonly operand:'file'}], {guiGrammar:'positional'}>;
export const modernMaybeSeparator: ModernMaybeSeparator = [{operand:'HEAD'}, {operand:possibleSeparator}, {operand:'file'}];

export type BadKnownSeparatorAlongsideOpaque = Reject<CheckedCommandArguments<'gui browser', readonly [{readonly operand:typeof possibleSeparator}, {readonly operand:'HEAD'}, {readonly operand:'file'}], {guiGrammar:'positional'}>>;

declare const unrelatedGuiString: string;
// @ts-expect-error An opaque later operand does not repair an invalid operation.
git.command('gui', [{operand:'not-a-gui-operation'}, {operand:unrelatedGuiString}]);
export type NoDirectTclVersion = Reject<CheckedCommandArguments<'gui', readonly [readonly ['--version']], {guiLaunch:'direct-tcl'}>>;

// @ts-expect-error The UI cannot consume two remaining words; one trace removal cannot repair them.
git.command('gui gui', [{operand:unrelatedGuiString}, {operand:unrelatedGuiString}]);
