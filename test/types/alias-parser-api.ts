import type { GitCommandClient } from '../../src/commands/types.js';
declare const git: GitCommandClient;
declare const dynamic: string;
// Both native alias names match these prefixes; this is not an ambiguity.
git.command('clone', [{ operand: '--recur' }, ['-h']]);
git.command('clone', [{ operand: '--no-recur' }, ['-h']]);
// @ts-expect-error The unrelated negotiation-include option makes this prefix ambiguous.
git.command('fetch', [{ operand: '--negotiation-=HEAD' }, ['-h']]);
git.command('fetch', [{ operand: '--negotiation-t=HEAD' }, ['-h']]);
git.command('push', [{ operand: '--bra' }, ['--tags'], ['-h']]);
git.command('push', [{ operand: '--no-bra' }, ['-h']]);
git.command('clone', [['--'], { operand: 'remote.git' }, ['-h']]);
git.command('fetch', [['--dry-run'], ['--'], ['-h'], { operand: 'main' }]);
git.command('push', [['--dry-run'], { operand: '--end-of-options' }, ['-h'], { operand: 'main' }]);
git.command('clone', [{ operand: dynamic }, ['-h']]);
// @ts-expect-error An alias inherits the target flag's rejection of attached values.
git.command('push', [{ operand: '--branches=1' }, ['-h']]);
// @ts-expect-error A normal unresolved ambiguity still fails before help.
git.command('clone', [{ operand: '--s' }, ['-h']]);
// @ts-expect-error Unknown options fail before help in the ordinary parser.
git.command('fetch', [{ operand: '--unknown' }, ['-h']]);
// @ts-expect-error -h after the consumed marker is an extra operand, not help.
git.command('clone', [['--'], { operand: 'one' }, { operand: 'two' }, ['-h']]);
