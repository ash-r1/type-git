import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('merge-recursive', [['--ours'], ['--theirs'], ['--'], { operand: 'HEAD' }, { operand: 'other' }]);
git.command('merge-subtree', [['--'], { operand: 'HEAD' }, { operand: 'other' }]);
// @ts-expect-error Heads must follow a separator.
git.command('merge-recursive', [{ operand: 'HEAD' }, { operand: 'other' }]);
// @ts-expect-error Only two heads.
git.command('merge-recursive-theirs', [['--'], { operand: 'HEAD' }, { operand: 'other' }, { operand: 'third' }]);
git.command('merge-index', [['-o'], { operand: 'true' }]);
// @ts-expect-error The native entrypoint requires two words.
git.command('merge-index', [{ operand: 'true' }]);
git.command('difftool', [['--extcmd', 'true'], ['--no-prompt']]);
// @ts-expect-error Explicit GUI and tool selections conflict.
git.command('difftool', [['--gui'], ['--tool', 'vimdiff']]);
// @ts-expect-error A final empty external command is invalid.
git.command('difftool', [['--extcmd', '']]);
git.command('difftool', [['--tool-help'], ['--gui'], ['--tool', 'unused'], ['--diff-algorithm', 'unknown']]);
git.command('mergetool', [['--gui'], ['--tool', 'unused']]);
git.command('request-pull', [{ operand: 'HEAD~1' }, ['-p'], { operand: 'repo' }, { operand: 'HEAD' }, { operand: 'ignored' }]);
// @ts-expect-error A start and URL are required.
git.command('request-pull', [{ operand: 'HEAD' }]);

git.command('merge-recursive', [['--help']]);
git.command('merge-recursive', [['--help'], ['--']]);
// @ts-expect-error Later --help is not global dispatch in the manual merge parser.
git.command('merge-recursive', [['--ours'], ['--help']]);

git.command('merge-recursive-ours', [['--help']]);
git.command('merge-recursive-ours', [['--help'], ['--']]);
// @ts-expect-error Later --help is not global dispatch in the manual merge parser.
git.command('merge-recursive-ours', [['--ours'], ['--help']]);

git.command('merge-recursive-theirs', [['--help']]);
git.command('merge-recursive-theirs', [['--help'], ['--']]);
// @ts-expect-error Later --help is not global dispatch in the manual merge parser.
git.command('merge-recursive-theirs', [['--ours'], ['--help']]);

git.command('merge-subtree', [['--help']]);
git.command('merge-subtree', [['--help'], ['--']]);
// @ts-expect-error Later --help is not global dispatch in the manual merge parser.
git.command('merge-subtree', [['--ours'], ['--help']]);

declare const chooseHelp: boolean;
const helpVariants = chooseHelp ? [['--help']] as const : [['--help'], ['--']] as const;
git.command('merge-recursive', helpVariants);

git.command('merge-recursive', [['-h']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive', [['-h'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive', [['--ours'], ['-h']]);
git.command('merge-recursive', [['--help-all']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive', [['--help-all'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive', [['--ours'], ['--help-all']]);
git.command('merge-recursive-ours', [['-h']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-ours', [['-h'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-ours', [['--ours'], ['-h']]);
git.command('merge-recursive-ours', [['--help-all']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-ours', [['--help-all'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-ours', [['--ours'], ['--help-all']]);
git.command('merge-recursive-theirs', [['-h']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-theirs', [['-h'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-theirs', [['--ours'], ['-h']]);
git.command('merge-recursive-theirs', [['--help-all']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-theirs', [['--help-all'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-recursive-theirs', [['--ours'], ['--help-all']]);
git.command('merge-subtree', [['-h']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-subtree', [['-h'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-subtree', [['--ours'], ['-h']]);
git.command('merge-subtree', [['--help-all']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-subtree', [['--help-all'], ['--']]);
// @ts-expect-error Native short/all help requires the sole argument.
git.command('merge-subtree', [['--ours'], ['--help-all']]);
// @ts-expect-error The required URL must not be empty.
git.command('request-pull', [{ operand: 'HEAD' }, { operand: '' }]);
declare const dynamicUrl: string;
git.command('request-pull', [{ operand: 'HEAD' }, { operand: dynamicUrl }]);
git.command('difftool', [['-S', '--tool-help'], { operand: 'HEAD' }, { operand: 'HEAD' }]);
git.command('difftool', [['--no-index'], { operand: 'left' }, { operand: 'right' }, ['--'], { operand: '*.ts' }]);
git.command('difftool', [['-G', '--tool-help'], { operand: 'HEAD' }, { operand: 'HEAD' }]);

// @ts-expect-error Empty delegated pickaxe patterns cannot consume the following operand.
git.command('difftool', [['-S', ''], { operand: 'HEAD' }, { operand: 'HEAD' }]);
// @ts-expect-error Later patterns cannot replace a prior empty callback value.
git.command('difftool', [['-S', ''], ['-S', 'one']]);
git.command('difftool', [['-S', ''], ['--tool-help'], { operand: 'HEAD' }]);
git.command('difftool', [['--tool-help'], ['-S', '']]);
// @ts-expect-error Empty delegated pickaxe patterns cannot consume the following operand.
git.command('difftool', [['-G', ''], { operand: 'HEAD' }, { operand: 'HEAD' }]);
// @ts-expect-error Later patterns cannot replace a prior empty callback value.
git.command('difftool', [['-G', ''], ['-G', 'one']]);
git.command('difftool', [['-G', ''], ['--tool-help'], { operand: 'HEAD' }]);
git.command('difftool', [['--tool-help'], ['-G', '']]);
// @ts-expect-error Disabling tool-help restores delegated validation.
git.command('difftool', [['--tool-help'], ['--no-tool-help'], ['-S', '']]);
declare const dynamicPattern: string;
git.command('difftool', [['-S', dynamicPattern]]);
declare const maybeEmptyPattern: '' | 'one';
// @ts-expect-error Every literal alternative must have a nonempty pattern.
git.command('difftool', [['-G', maybeEmptyPattern]]);

const mixedEmptyPatternModes = chooseHelp ? [['-S', ''], ['--tool-help']] as const : [['-S', '']] as const;
// @ts-expect-error A union must also satisfy the branch that delegates to diff.
git.command('difftool', mixedEmptyPatternModes);
const validEmptyPatternHelpModes = chooseHelp ? [['-S', ''], ['--tool-help']] as const : [['--tool-help'], ['-G', '']] as const;
git.command('difftool', validEmptyPatternHelpModes);
