import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('shell', []);
git.command('shell', [['-c', 'custom argument']]);
git.command('shell', [{ operand: 'cvs server' }]);
// @ts-expect-error Command mode takes no extra words.
git.command('shell', [['-c', 'custom'], { operand: 'extra' }]);
// @ts-expect-error Repeating -c is a native argc error.
git.command('shell', [['-c', 'custom'], ['-c', 'custom']]);
// @ts-expect-error Only the special compatibility word is accepted without -c.
git.command('shell', [{ operand: 'custom' }]);
git.command('filter-branch', [['--env-filter', ':'], ['--'], { operand: 'HEAD' }]);
// @ts-expect-error Even an empty explicit commit filter conflicts with prune-empty.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', '']]);
git.command('quiltimport', [['--dry-run'], { operand: 'ignored' }]);
git.command('instaweb', [{ operand: 'start' }, { operand: 'stop' }]);
// @ts-expect-error All action words are checked, not just operand zero.
git.command('instaweb', [{ operand: 'stop' }, { operand: 'unknown' }]);
git.command('instaweb stop', [['--port', 'unvalidated-by-stop']]);
// @ts-expect-error Git installs this as a sourced library, not a standalone command.
git.command('sh-setup', [{ operand: '-h' }]);
// @ts-expect-error The other sourced library is not a standalone command either.
git.command('sh-i18n', [{ operand: '-h' }]);


import type { Constraint } from '../../src/constraints/model.js';
const valueRule: Extract<Constraint, { kind: 'value' }> = {
  id: 'test.value-discrimination', kind: 'value', key: 'action', allowed: ['stop'],
  origin: 'git', source: 'fixture', reason: 'Value rules retain a separate discriminator.',
};
const elementRule = {
  id: 'test.elements-discrimination', kind: 'elements', key: 'actions', allowed: ['stop'],
  origin: 'git', source: 'fixture', reason: 'Element rules retain a separate discriminator.',
} as const satisfies Extract<Constraint, { kind: 'elements' }>;
void [valueRule, elementRule];
declare const dynamicAction: string;
declare const opaqueAction: string & { readonly __action: unique symbol };
declare const templateAction: `st${string}`;
git.command('instaweb', [{ operand: dynamicAction }]);
git.command('instaweb', [{ operand: opaqueAction }]);
git.command('instaweb', [{ operand: templateAction }]);
declare const mixedAction: 'stop' | 'invalid';
// @ts-expect-error All finite element alternatives must be valid actions.
git.command('instaweb', [{ operand: mixedAction }]);


import type { Constrained } from '../../src/constraints/types.js';
// @ts-expect-error Known object elements cannot belong to a primitive vocabulary.
const invalidObjects: Constrained<{ actions: readonly object[] }, readonly [typeof elementRule]> = { actions: [{}] };
void invalidObjects;


git.command('shell', [['--help']]);
git.command('shell', [['--help'], { operand: 'ignored' }]);
// @ts-expect-error Global documentation dispatch only starts at the first argument.
git.command('shell', [['-c', 'fixture'], ['--help']]);
// @ts-expect-error Short -h is not the global documentation dispatcher here.
git.command('shell', [['-h']]);


import type { GitCommandName } from '../../src/commands/types.js';
type AssertNoCommand<T extends never> = T;
export type SourcedLibrariesHaveNoStandaloneCommand = AssertNoCommand<
  Extract<GitCommandName, 'sh-setup' | 'sh-i18n'>
>;


git.command('filter-branch', [['-h']]);
git.command('filter-branch', [['--help']]);
// @ts-expect-error Late short help does not invoke the sourced-library early exit.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', ''], ['-h']]);
// @ts-expect-error Late long help is not Git's global documentation dispatch.
git.command('filter-branch', [['--prune-empty'], ['--commit-filter', ''], ['--help']]);

// First-word documentation dispatch belongs to git-help, including its usage-exit profile.
git.command('shell', [['--help'], ['--help']]);
// @ts-expect-error A help flag still cannot take a value.
git.command('shell', [['--help'], ['--help', 'extra']]);
// @ts-expect-error Unknown option shapes remain rejected after documentation dispatch.
git.command('shell', [['--help'], ['--unknown']]);
// @ts-expect-error OS argument strings cannot contain NUL, even after help.
git.command('shell', [['--help'], { operand: 'a\0b' }]);

// Manual format selectors are git-help options only after exact first-word --help.
git.command('shell', [['--help'], ['--man']]);
git.command('shell', [['--help'], ['-m']]);
git.command('shell', [['--help'], ['--no-man']]);
git.command('filter-branch', [['--help'], ['--no-man'], ['--man']]);
declare const manualSelector: '--man' | '-m' | '--no-man';
git.command('shell', [['--help'], [manualSelector]]);
// @ts-expect-error A manual selector is not a local shell option.
git.command('shell', [['--man']]);
// @ts-expect-error These selectors are not local filter-branch options.
git.command('filter-branch', [['--no-man']]);
// @ts-expect-error A preceding local option does not enter documentation dispatch.
git.command('shell', [['-c', 'fixture'], ['--help'], ['--man']]);
// @ts-expect-error Manual selectors are value-less flags.
git.command('shell', [['--help'], ['--man', true]]);
// @ts-expect-error Unknown options are still rejected in a documentation tail.
git.command('shell', [['--help'], ['--unknown']]);
// @ts-expect-error NUL remains unrepresentable after manual selection.
git.command('shell', [['--help'], ['--man'], { operand: 'a\0b' }]);
declare const possibleFirstWord: '--help' | '--man';
// @ts-expect-error Every possible first word must select documentation dispatch.
git.command('shell', [[possibleFirstWord], ['--man']]);

// Context-dependent selectors require a provable documentation prefix on dynamic arrays.
declare const unprefixedManualArray: readonly (readonly ['--man'])[];
// @ts-expect-error An arbitrary-length array does not establish the documentation prefix.
git.command('shell', unprefixedManualArray);
declare const mixedDocumentationArray: readonly (readonly ['--help'] | readonly ['--man'])[];
// @ts-expect-error This array may start with a manual selector.
git.command('shell', mixedDocumentationArray);
declare const mixedDocumentationWord: readonly (readonly ['--help' | '--man'])[];
// @ts-expect-error A union inside a token must not hide the manual-selector alternative.
git.command('shell', mixedDocumentationWord);
declare const prefixedManualArray: readonly [readonly ['--help'], ...(readonly ['--man' | '-m' | '--no-man'])[]];
git.command('shell', prefixedManualArray);
declare const ordinaryShellArray: readonly (readonly ['-c', string])[];
git.command('shell', ordinaryShellArray);
declare const ordinaryHelpArray: readonly (readonly ['--help'])[];
git.command('shell', ordinaryHelpArray);
