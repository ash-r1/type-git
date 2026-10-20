import type { SvnSelect, SvnWords } from '../../src/commands/svn-dispatch-types.js';
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Commands = { fetch: 'svn fetch'; init: 'svn init' };
export type ShortValue = Assert<Equal<
  SvnSelect<SvnWords<readonly [readonly ['-i', 'fetch'], { operand: 'init' }, readonly ['-h']]>, Commands>,
  { kind: 'command'; command: 'svn fetch'; remaining: readonly ['-i', 'init', '-h'] }
>>;
export type EqualsValue = Assert<Equal<
  SvnSelect<SvnWords<readonly [readonly ['--id', 'fetch'], { operand: 'init' }]>, Commands>,
  { kind: 'command'; command: 'svn init'; remaining: readonly ['--id=fetch'] }
>>;
export type HelpBeforeOptions = Assert<Equal<
  SvnSelect<readonly ['ignored', 'help', 'fetch', '--unknown'], Commands>, { kind: 'help' }
>>;
export type FiniteUnion = Assert<Equal<
  SvnSelect<readonly ['fetch' | 'init', '-h'], Commands>,
  { kind: 'command'; command: 'svn fetch'; remaining: readonly ['-h'] } |
  { kind: 'command'; command: 'svn init'; remaining: readonly ['-h'] }
>>;

import type { TypeGit } from '../../src/adapters/node/index.js';
declare const git: TypeGit;
git.command('svn', [{ operand: 'ignored' }, { operand: 'fetch' }, ['--log-window-size', '1'], ['-h']]);
git.command('svn', [['-i', 'fetch'], { operand: 'init' }, ['--log-window-size', '1'], ['-h']]);
// @ts-expect-error selected fetch still rejects an invalid integer before help
git.command('svn', [{ operand: 'ignored' }, { operand: 'fetch' }, ['--log-window-size', '1x'], ['-h']]);

declare const selected: 'fetch' | 'init';
// @ts-expect-error init does not accept fetch-only --log-window-size
git.command('svn', [{ operand: selected }, ['--log-window-size', '1'], ['-h']]);

git.command('svn', [{ operand: 'ignored' }, { operand: 'fetch' }, ['--repack'], ['-h']]);
git.command('svn fetch', [['--repack'], ['-h']]);
git.command('svn init', [['--shared'], ['-h']]);
