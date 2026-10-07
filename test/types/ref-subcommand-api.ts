import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const dynamic: string;

// Native -h means show HEAD; long internal help has a separate exit token.
git.command('show-ref', [['-h']]);
git.command('show-ref', [['-h'], ['--verify'], ['--help-all']]);
git.command('show-ref', [['--help-all'], ['--abbrev', 'bad']]);
// @ts-expect-error The HEAD flag does not bypass final verify arity.
git.command('show-ref', [['-h'], ['--verify']]);
// @ts-expect-error The HEAD flag does not bypass a reached integer callback.
git.command('show-ref', [['-h'], ['--abbrev', 'bad'], ['--help-all']]);
// @ts-expect-error Hash's reached wrapper delegates explicit values to the abbrev callback.
git.command('show-ref', [['--hash', 'bad'], ['--help-all']]);
// @ts-expect-error An explicitly empty hash length is also rejected before help.
git.command('show-ref', [['--hash', ''], ['--help-all']]);
// @ts-expect-error A native h flag in a cluster cannot conceal an unknown x.
git.command('show-ref', [{ operand: '-hx' }, ['--help-all']]);
// @ts-expect-error Native h flags do not bypass final operation conflicts.
git.command('show-ref', [['--verify'], ['--exists'], ['-h']]);

git.command('refs list', [{ operand: '--col=always' }, ['-h']]);
git.command('refs list', [['--'], ['-h']]);
// @ts-expect-error A retained pattern still conflicts with stdin mode.
git.command('refs list', [['--stdin'], ['--'], ['-h']]);
git.command('refs exists', [['--'], { operand: 'refs/heads/main' }]);
// @ts-expect-error After the boundary, -h is an extra literal reference.
git.command('refs exists', [['--'], { operand: 'refs/heads/main' }, ['-h']]);
git.command('refs migrate', [{ operand: '--ref-f=bad' }, ['-h']]);
// @ts-expect-error An unknown storage format is checked after ordinary parsing.
git.command('refs migrate', [['--ref-format', 'bad']]);
// @ts-expect-error Retained words cannot bypass verify's zero-operand rule.
git.command('refs verify', [['--'], ['-h']]);
// @ts-expect-error Optimize also has no retained operands.
git.command('refs optimize', [['--'], ['-h']]);

git.command('symbolic-ref', [['-m', ''], ['-h']]);
// @ts-expect-error Empty messages are checked after parsing when help was not reached.
git.command('symbolic-ref', [['-m', ''], { operand: 'HEAD' }]);
git.command('symbolic-ref', [['--'], { operand: 'HEAD' }]);
git.command('verify-tag', [{ operand: '--for=bad' }, ['-h']]);
git.command('verify-commit', [{ operand: '-vhh' }]);
// @ts-expect-error KEEP_ARGV0 does not supply a public tag operand.
git.command('verify-tag', [['--']]);
// @ts-expect-error KEEP_ARGV0 does not supply a public commit operand.
git.command('verify-commit', [['--']]);

git.command('show-ref', [{ operand: dynamic }, ['--help-all']]);
git.command('refs list', [{ operand: dynamic }, ['-h']]);
