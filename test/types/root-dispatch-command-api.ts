import type { Git } from '../../src/core/git.js';
declare const git: Git;
git.command('bundle', [{ operand: 'verify' }, { operand: '--quiet' }, { operand: 'file.bundle' }]);
git.command('commit-graph', [['--object-dir', '.git/objects'], { operand: 'verify' }]);
git.command('multi-pack-index', [['--no-progress'], { operand: 'verify' }]);
git.command('history', [{ operand: 'reword' }, { operand: '--dry-run' }, { operand: 'HEAD' }]);
git.command('hook', [{ operand: 'run' }, { operand: '--ignore-missing' }, { operand: 'pre-commit' }]);
git.command('maintenance', [{ operand: 'run' }]);
git.command('refs', [{ operand: 'verify' }]);
git.command('repo', [{ operand: 'info' }]);
// @ts-expect-error Bundle requires an operation.
git.command('bundle', []);
// @ts-expect-error The dispatcher does not accept unknown operations.
git.command('refs', [{ operand: 'unknown' }]);
// @ts-expect-error Subcommand flags must follow the operation as delegated words.
git.command('bundle', [['--quiet'], { operand: 'verify' }, { operand: 'file.bundle' }]);
// @ts-expect-error Parsed parent options cannot follow the operation.
git.command('commit-graph', [{ operand: 'verify' }, ['--object-dir', '.git/objects']]);
