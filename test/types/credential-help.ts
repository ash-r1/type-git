import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('credential', [['-h']]);
git.command('credential', [['--help-all']]);
git.command('credential', [{ operand: '-h' }]);
git.command('credential', [{ operand: '--help-all' }]);
git.command('credential', [{ operand: 'approve' }], { stdin: 'protocol=https\nhost=fixture.invalid\n\n' });
git.command('credential', [{ operand: 'reject' }]);
git.command('credential', [{ operand: 'capability' }]);
git.command('credential', [['--help'], ['--man']]);
declare const credentialUsage: '-h' | '--help-all';
git.command('credential', [[credentialUsage]]);
declare const credentialUsageOrDocs: '-h' | '--help';
git.command('credential', [[credentialUsageOrDocs]]);
declare const credentialOpOrUsage: 'approve' | '-h';
git.command('credential', [{ operand: credentialOpOrUsage }]);
declare const credentialInvalidUsage: '-h' | 'ordinary';
// @ts-expect-error Every operand union arm must be a supported operation or usage word.
git.command('credential', [{ operand: credentialInvalidUsage }]);
// @ts-expect-error One operation word is required.
git.command('credential', []);
// @ts-expect-error Unknown operation.
git.command('credential', [{ operand: 'ordinary' }]);
// @ts-expect-error Canonical usage cannot hide another argument.
git.command('credential', [['-h'], { operand: 'approve' }]);
// @ts-expect-error Tagged usage is subject to raw arity.
git.command('credential', [{ operand: '-h' }, { operand: 'approve' }]);
// @ts-expect-error No flag union arm permits a second word.
git.command('credential', [[credentialUsage], { operand: 'approve' }]);
// @ts-expect-error Documentation dispatch must be first-word.
git.command('credential', [{ operand: 'approve' }, ['--help']]);
// @ts-expect-error No separator option.
git.command('credential', [['--']]);
// @ts-expect-error Flag takes no attached value.
git.command('credential', [['-h', true]]);
