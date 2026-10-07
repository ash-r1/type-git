import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('scalar version', [['--build-options']]);
git.command('scalar', [{ operand: 'version' }, ['--build-options']]);
git.command('scalar clone', [['--no-maintenance'], { operand: 'url' }]);
git.command('scalar run', [{ operand: 'commit-graph' }]);
// @ts-expect-error Scalar run only recognizes its registered tasks.
git.command('scalar run', [{ operand: 'unknown' }]);
// @ts-expect-error Scalar clone requires a URL.
git.command('scalar clone', []);
// @ts-expect-error Root dispatch selects version's operand restriction.
git.command('scalar', [{ operand: 'version' }, { operand: 'extra' }]);
// @ts-expect-error Scalar list never accepts operands.
git.command('scalar list', [{ operand: 'extra' }]);
git.command('scalar reconfigure', [['--maintenance', 'ignored-without-all']]);
// @ts-expect-error Maintenance mode is validated in all mode.
git.command('scalar reconfigure', [['--all'], ['--maintenance', 'invalid']]);
git.command('scalar reconfigure', [['--all'], ['--maintenance', 'invalid'], ['--maintenance', 'keep']]);
git.command('gitk', [['--select-commit', 'HEAD'], { operand: '--all' }]);
git.command('gitweb', [['--nproc', -1]]);
