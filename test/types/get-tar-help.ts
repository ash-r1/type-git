import type { Git } from '../../src/index.js';
declare const git: Git;
git.command('get-tar-commit-id', []);
git.command('get-tar-commit-id', [], { stdin: new Uint8Array(1024) });
git.command('get-tar-commit-id', [['-h']]);
git.command('get-tar-commit-id', [['--help-all']]);
git.command('get-tar-commit-id', [{ operand: '-h' }]);
git.command('get-tar-commit-id', [{ operand: '--help-all' }]);
git.command('get-tar-commit-id', [['--help'], ['--man']]);
// @ts-expect-error Ordinary input mode does not accept operands.
git.command('get-tar-commit-id', [{ operand: 'ordinary' }]);
// @ts-expect-error Canonical help cannot hide another word.
git.command('get-tar-commit-id', [['-h'], { operand: 'ignored' }]);
// @ts-expect-error Tagged usage words remain sole-word-only.
git.command('get-tar-commit-id', [{ operand: '-h' }, { operand: 'ignored' }]);
// @ts-expect-error Flag shape remains enforced.
git.command('get-tar-commit-id', [['--help-all', true]]);
// @ts-expect-error No separator option is supported.
git.command('get-tar-commit-id', [['--']]);
declare const getTarHelp: '-h' | '--help-all';
git.command('get-tar-commit-id', [[getTarHelp]]);
git.command('get-tar-commit-id', [{ operand: getTarHelp }]);
declare const getTarMaybeHelp: '-h' | 'ordinary';
// @ts-expect-error Every operand union arm must be a usage spelling.
git.command('get-tar-commit-id', [{ operand: getTarMaybeHelp }]);
// @ts-expect-error No flag union arm permits another word.
git.command('get-tar-commit-id', [[getTarHelp], { operand: 'ignored' }]);

// @ts-expect-error Only first-word --help selects documentation dispatch.
git.command('get-tar-commit-id', [{ operand: 'ordinary' }, ['--help']]);
