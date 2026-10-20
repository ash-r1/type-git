import type { TypeGit } from '../../src/adapters/node/index.js';
declare const git: TypeGit;

declare const idFlag: '-i' | '--id';
// @ts-expect-error long equals selects init, which rejects the fetch-only option
git.command('svn', [[idFlag, 'fetch'], { operand: 'init' }, ['--log-window-size', '1'], ['-h']]);

declare const optionToken: readonly ['--log-window-size', '1'] | readonly ['--log-window-size', '1x'];
// @ts-expect-error a known invalid integer arm must not become opaque input
git.command('svn', [{ operand: 'ignored' }, { operand: 'fetch' }, optionToken, ['-h']]);

git.command('svn', [{ operand: 'ignored' }, { operand: 'help' }, { operand: 'fetch' }, ['--log-window-size', '1x']]);
git.command('svn', [['-i', 'help'], { operand: 'fetch' }, ['--log-window-size', '1x']]);
// @ts-expect-error -h is parsed after GetOptions validates all supplied integers
git.command('svn', [{ operand: 'fetch' }, ['-h'], ['--log-window-size', '1x']]);
// @ts-expect-error command selection consumes fetch, leaving -i without its argument
git.command('svn', [['-i', 'fetch']]);

declare const validToken: readonly ['--log-window-size', '1'] | readonly ['--log-window-size', '2'];
git.command('svn', [{ operand: 'ignored' }, { operand: 'fetch' }, validToken, ['-h']]);
declare const validIdFlag: '-i' | '--id';
git.command('svn', [[validIdFlag, 'fetch'], { operand: 'init' }, ['-h']]);
