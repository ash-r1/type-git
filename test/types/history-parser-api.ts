import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const dynamic: string;

git.command('merge', [{ operand: '--ff-o' }, ['-h']]);
git.command('merge', [['-h'], ['--file', '']]);
git.command('merge', [['--'], ['-h']]);
// @ts-expect-error The reached message-file callback cannot read an empty filename.
git.command('merge', [['--file', ''], ['-h']]);
// @ts-expect-error The reached message-file callback also applies to its short form.
git.command('merge', [['-F', ''], ['-h']]);
// @ts-expect-error A reached unknown option cannot be rescued by later help.
git.command('merge', [{ operand: '--unknown' }, ['-h']]);

git.command('rebase', [{ operand: '--keep-b' }, ['--onto', 'main'], ['-h']]);
git.command('rebase', [['--'], ['-h']]);
// @ts-expect-error Reached backend callbacks reject changing the selected backend.
git.command('rebase', [{ operand: '--mer' }, { operand: '--app' }, ['-h']]);

git.command('for-each-ref', [{ operand: '--col=always' }, ['-h']]);
git.command('for-each-ref', [['--'], ['-h']]);
// @ts-expect-error An empty object-name callback fails before help.
git.command('for-each-ref', [['--points-at', ''], ['-h']]);
// @ts-expect-error Literal patterns after -- still conflict with stdin mode.
git.command('for-each-ref', [['--stdin'], ['--'], ['-h']]);

// After the first operand, show-branch treats every following word as a ref.
git.command('show-branch', [{ operand: 'main' }, ['-h']]);
git.command('show-branch', [{ operand: 'main' }, ['--color', 'invalid']]);
git.command('show-branch', [{ operand: '--col=always' }, ['-h']]);
git.command('show-branch', [['--'], ['-h']]);
// @ts-expect-error The reached reflog callback rejects malformed decimal syntax.
git.command('show-branch', [{ operand: '--refl=bad' }, ['-h']]);

git.command('merge', [{ operand: dynamic }, ['-h']]);
git.command('rebase', [{ operand: dynamic }, ['-h']]);
git.command('for-each-ref', [{ operand: dynamic }, ['-h']]);
git.command('show-branch', [{ operand: dynamic }, ['-h']]);
