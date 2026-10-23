import type {Git} from '../../src/index.js';
declare const git:Git;
git.command('backfill',[['--date','invalid'],['-h']]);
git.command('backfill',[['-h'],['--min-batch-size','invalid']]);
git.command('last-modified',[['--date','invalid'],['-h']]);
git.command('last-modified',[['-h'],['--max-depth','invalid']]);
git.command('replay',[['--date','invalid'],['-h']]);
git.command('replay',[['--onto','HEAD'],['--advance','branch'],['-h']]);
git.command('replay',[['--onto','HEAD'],['--date','iso'],{operand:'HEAD^..HEAD'}]);
git.command('backfill',[['-h'],['--'],['--date','invalid']]);
// @ts-expect-error A direct invalid date reaches the retained callback.
git.command('backfill',[['--date','invalid'],{operand:'HEAD'}]);
// @ts-expect-error Date validation is no longer unconditionally deferred.
git.command('last-modified',[['--date','invalid'],{operand:'HEAD'}]);
// @ts-expect-error With a replay mode, direct invalid date is rejected.
git.command('replay',[['--onto','HEAD'],['--date','invalid'],{operand:'HEAD^..HEAD'}]);
// @ts-expect-error An earlier native initial callback fails before later help.
git.command('backfill',[['--min-batch-size','invalid'],['-h']]);
// @ts-expect-error last-modified also retains its initial callback order.
git.command('last-modified',[['--max-depth','invalid'],['-h']]);
// @ts-expect-error Backfill explicit diff-merges remains unsupported.
git.command('backfill',[['--diff-merges','cc'],{operand:'HEAD'}]);
