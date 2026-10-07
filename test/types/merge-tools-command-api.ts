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
