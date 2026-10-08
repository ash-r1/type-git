import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
// These child options are ignored when refs/stash does not exist.
git.command('stash list', [['--color', 'bad']]);
git.command('stash list', [['--graph'], ['--reverse']]);
git.command('stash list', [['--max-count', 'not-a-number']]);
git.command('stash list', [['--decorate', dynamic]]);
git.command('stash list', [['--diff-algorithm', 'invalid']]);
git.command('stash list', [['--format', '%gs']]);
git.command('stash list', [['--'], ['--color', 'bad']]);
git.command('stash list', [{ operand: '--unknown' }]);
git.command('stash', [{ operand: 'list' }, ['--graph']]);
// Unconditional help exits even before the repository-ref gate.
git.command('stash list', [['--decorate', 'bad'], ['--help']]);
git.command('stash list', [['-h'], { operand: '-no-color' }]);
// @ts-expect-error Native typo detection runs before checking refs/stash.
git.command('stash list', [{ operand: '-no-color' }]);
// @ts-expect-error Representation checks still apply after help.
git.command('stash list', [['-h'], ['--format', 'x\0y']]);
// @ts-expect-error An option value must have its declared primitive shape.
git.command('stash list', [['--max-count', {}]]);
// @ts-expect-error Tuple option names must be declared; raw words use operand objects.
git.command('stash list', [['--unknown']]);
