import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('refs', [{ operand: 'list' }, ['--count', 1]]);
git.command('refs', [{ operand: 'verify' }, ['--verbose']]);
git.command('refs', [{ operand: 'list' }, ['--shell'], ['--python'], ['-h']]);
git.command('refs', [['-h'], { operand: 'list' }, ['--count', 'bad']]);
git.command('refs', [{ operand: '--help-all' }, { operand: 'list' }, ['--count', 'bad']]);
git.command('refs', [['--help'], { operand: 'list' }, ['--count', 'bad']]);
// @ts-expect-error Mandatory native selection stops at an unknown operand before help.
git.command('refs', [{ operand: 'unknown' }, ['-h']]);
// @ts-expect-error The marker ends the mandatory parent pass before selection.
git.command('refs', [['--'], { operand: 'list' }]);
// @ts-expect-error --end-of-options also ends the mandatory parent pass.
git.command('refs', [{ operand: '--end-of-options' }, { operand: 'list' }]);
// @ts-expect-error OPTION_SUBCOMMAND matches exact names, without abbreviation.
git.command('refs', [{ operand: 'ver' }, ['-h']]);
// @ts-expect-error The selected child parser rejects malformed count before help.
git.command('refs', [{ operand: 'list' }, ['--count', 'bad'], ['-h']]);
// @ts-expect-error The child final rule rejects multiple quote styles.
git.command('refs', [{ operand: 'list' }, ['--shell'], ['--python']]);
// @ts-expect-error The selected child requires an existing-ref operand syntactically.
git.command('refs', [{ operand: 'exists' }]);
// @ts-expect-error Required subcommand selection also applies to an empty argv.
git.command('refs', []);
declare const operation: string;
git.command('refs', [{ operand: operation }, ['-h']]);

git.command('refs', [{ operand: 'verify' }, { operand: '--help' }]);
git.command('refs verify', [{ operand: '--help' }]);
declare const uncertain: 'list' | 'unknown';
// @ts-expect-error An invalid literal union member cannot be erased by a valid selection.
git.command('refs', [{ operand: uncertain }, ['-h']]);

git.command('refs', [{ operand: 'verify' }, ['--help-all']]);
