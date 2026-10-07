import type { Git } from '../../src/core/git.js';
declare const git: Git;
declare const dynamic: string;
declare const branch: '--quiet' | '--quiet=1';
git.command('stash push', [['--unified', '-2'], ['-h']]);
git.command('stash save', [['--patch'], ['--include-untracked'], ['--help']]);
git.command('stash apply', [{ operand: '--label-o=ours' }, ['-h']]);
git.command('stash pop', [{ operand: '-qh' }]);
git.command('stash drop', [{ operand: '--n' }, ['-h']]);
git.command('stash store', [{ operand: '--unknown' }, ['-h']]);
git.command('stash store', [['--'], { operand: '-h' }]);
git.command('stash clear', [['-h'], { operand: '-unknown' }]);
git.command('stash push', [{ operand: dynamic }]);
git.command('stash save', [['--'], ['--unified', 'bad']]);
git.command('stash', [{ operand: 'push' }, ['--unified', '-2'], ['-h']]);
// @ts-expect-error Integer syntax is checked by the reached callback before help.
git.command('stash push', [['--unified', 'bad'], ['-h']]);
// @ts-expect-error This prefix matches more than one native option.
git.command('stash apply', [{ operand: '--label=ours' }, ['-h']]);
// @ts-expect-error A very short negation with attached data is not the bare --n spelling.
git.command('stash drop', [{ operand: '--n=1' }, ['-h']]);
// @ts-expect-error The raw literal union includes a forbidden value on a flag.
git.command('stash pop', [{ operand: branch }, ['-h']]);
// @ts-expect-error Clear stops before -h, then rejects its remaining operands.
git.command('stash clear', [{ operand: 'file' }, ['-h']]);
// @ts-expect-error Unknown options fail in ordinary parsers before help.
git.command('stash apply', [{ operand: '--unknown' }, ['-h']]);
// @ts-expect-error Known NUL bytes remain unrepresentable even after help.
git.command('stash drop', [['-h'], { operand: 'x\0y' }]);

// Assumed push stops on the first path; later option-shaped words are literal paths.
git.command('stash', [['--patch'], { operand: 'file' }, ['--unified', 'bad']]);
git.command('stash', [['--'], ['--unified', 'bad']]);
git.command('stash', [['--']]);
git.command('stash', [['--unified', '-2'], ['-h']]);
git.command('stash', [{ operand: '-qh' }]);
// @ts-expect-error A later separator does not retroactively enable assumed push paths.
git.command('stash', [{ operand: 'file' }, ['--'], ['-h']]);
// @ts-expect-error Help after the first operand is a literal path.
git.command('stash', [{ operand: 'file' }, ['-h']]);
// @ts-expect-error The integer callback is reached before help.
git.command('stash', [['--unified', 'bad'], ['-h']]);
// @ts-expect-error The wrapper detects a single-dash subcommand typo before push's -p.
git.command('stash', [{ operand: '-push' }, ['-h']]);
