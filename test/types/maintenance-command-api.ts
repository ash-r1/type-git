import type { Git } from '../../src/core/git.js';
import type { GitCommandArgument } from '../../src/commands/types.js';
declare const git: Git;
declare const task: string;
git.command('maintenance run', [['--task', 'InCrEmEnTaL-RePaCk'], ['--auto']]);
git.command('maintenance run', [['--task', 'gc'], ['--task', 'GC']]);
git.command('maintenance run', [['--task', task], ['--task', 'gc']]);
git.command('maintenance is-needed', [['--task', 'pack-refs']]);
git.command('maintenance run', [['--schedule', 'DaIlY']]);
git.command('maintenance start', [['--scheduler', 'SyStEmD-TiMeR']]);
// @ts-expect-error Exact repeated spelling is rejected immediately.
git.command('maintenance run', [['--task', 'gc'], ['--task', 'gc']]);
// @ts-expect-error Invalid task remains invalid before help.
git.command('maintenance is-needed', [['--task', 'unknown'], ['--help']]);
// @ts-expect-error Git uses ASCII case folding, not Unicode Kelvin-sign folding.
git.command('maintenance run', [['--task', 'pacK-refs']]);
// @ts-expect-error Invalid schedule cannot be repaired by a later value.
git.command('maintenance run', [['--schedule', 'monthly'], ['--schedule', 'daily']]);
// @ts-expect-error Auto and schedule cannot be combined.
git.command('maintenance run', [['--auto'], ['--schedule', 'daily']]);
// @ts-expect-error Task and schedule cannot be combined.
git.command('maintenance run', [['--task', 'gc'], ['--schedule', 'daily']]);
// @ts-expect-error Native callback rejects negated schedule.
git.command('maintenance run', [['--no-schedule']]);
// @ts-expect-error Maintenance takes no operands.
git.command('maintenance stop', [{ operand: 'extra' }]);
git.command('maintenance register', [['--config-file', '/tmp/registration']]);
git.command('maintenance unregister', [['--force']]);
git.command('gc', [['--auto'], ['--no-detach']]);
git.command('commit-graph write', [['--reachable'], ['--split', 'replace']]);
git.command('commit-graph verify', [['--shallow']]);
// @ts-expect-error Input sources are exclusive.
git.command('commit-graph write', [['--reachable'], ['--stdin-packs']]);
// @ts-expect-error Split callback is case-sensitive.
git.command('commit-graph write', [['--split', 'Replace']]);
git.command('multi-pack-index write', [['--incremental'], ['--no-write-chain-file'], ['--base', 'hash']]);
// @ts-expect-error No chain file requires incremental mode.
git.command('multi-pack-index write', [['--no-write-chain-file']]);
// @ts-expect-error Base requires no chain file.
git.command('multi-pack-index write', [['--base', 'hash']]);
git.command('multi-pack-index compact', [['--base', 'hash'], { operand: 'from' }, { operand: 'to' }]);
// @ts-expect-error Compact requires two endpoints.
git.command('multi-pack-index compact', [{ operand: 'from' }]);
git.command('multi-pack-index verify', []);
git.command('multi-pack-index expire', []);
git.command('multi-pack-index repack', [['--batch-size', 1048576]]);
git.command('refs migrate', [['--ref-format', 'bad earlier'], ['--ref-format', 'reftable'], ['--dry-run']]);
// @ts-expect-error Migration requires a format.
git.command('refs migrate', []);
git.command('refs verify', [['--strict']]);
git.command('refs exists', [{ operand: 'refs/heads/main' }]);
git.command('refs list', [['--format', '%(refname)']]);
// @ts-expect-error Shared for-each-ref quoting modes remain exclusive.
git.command('refs list', [['--shell'], ['--python']]);
git.command('refs optimize', [['--all'], ['--include', 'refs/heads/*']]);
git.command('pack-refs', [['--all'], ['--include', 'refs/heads/*']]);
git.command('fsck', [['--connectivity-only'], { operand: 'HEAD' }]);
git.command('fsck-objects', [['--strict']]);
git.command('prune', [['--dry-run'], { operand: 'HEAD' }]);
git.command('prune-packed', [['--dry-run']]);
git.command('update-server-info', [['--force']]);
git.command('stage', [['--all']]);
// @ts-expect-error Stage shares add's pathspec prerequisite.
git.command('stage', [['--pathspec-file-nul']]);
const dynamic: readonly GitCommandArgument<'maintenance run'>[] = [['--task', task]];
git.command('maintenance run', dynamic);
