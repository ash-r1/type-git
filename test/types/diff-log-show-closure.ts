import type { StrictGit } from '../../src/strict/index.js';
declare const git: StrictGit;
declare const dynamic: string;
declare const either: '1,2:a' | '1,2';
for (const command of ['log', 'show'] as const) {
  git.command(command, [['-L', '1,2:a']]);
  git.command(command, [['-L', ',:a']]);
  git.command(command, [['-L', ' 2,+3:a']]);
  git.command(command, [['-L', '2,-1:a']]);
  git.command(command, [['-L', '/b/,+2:a']]);
  git.command(command, [['-L', '^/b/,/c/:a']]);
  git.command(command, [['-L', '/[/,1:a']]);
  git.command(command, [['-L', '/\\//:a']]);
  git.command(command, [['-L', ':f:a']]);
  git.command(command, [['-L', '^:f:a']]);
  git.command(command, [['-L', ':\\::a']]);
  git.command(command, [['-L', '1:a:b']]);
  git.command(command, [['-L', '9999999999999999999999,+2:a']]);
  git.command(command, [['-L', dynamic]]);
  git.command(command, [['-L', `${1 as number},${2 as number}:${dynamic}`]]);
  git.command(command, [['-L', `${1 as number}:a`]]);
  git.command(command, [['-L', `${dynamic}:a`]]);
  git.command(command, [['-L', '1,2'], ['-h']]);
  // @ts-expect-error A range needs ':' and a file name.
  git.command(command, [['-L', '1,2']]);
  // @ts-expect-error The file name must not be empty.
  git.command(command, [['-L', '1,2:']]);
  // @ts-expect-error A range must scan completely before the file.
  git.command(command, [['-L', '1x:a']]);
  // @ts-expect-error An unterminated regex leaves the slash in front of the file.
  git.command(command, [['-L', '/b:a']]);
  // @ts-expect-error A function name must not be empty.
  git.command(command, [['-L', '::a']]);
  // @ts-expect-error A function name needs a file after it.
  git.command(command, [['-L', ':f']]);
  // @ts-expect-error Absolute line numbers start at 1.
  git.command(command, [['-L', '0,2:a']]);
  // @ts-expect-error A negative start is not a line number.
  git.command(command, [['-L', '-1:a']]);
  // @ts-expect-error An absolute end is a line number too.
  git.command(command, [['-L', '1, -1:a']]);
  // @ts-expect-error A relative length must not be zero.
  git.command(command, [['-L', '1,+00:a']]);
  // @ts-expect-error At LONG_MAX the end is read as an absolute line number.
  git.command(command, [['-L', '9999999999999999999999,-2:a']]);
  // @ts-expect-error Git reads past the argument after a final backslash in a regex scan.
  git.command(command, [['-L', '/b\\']]);
  // @ts-expect-error Every -L value is checked, not only the last one.
  git.command(command, [['-L', '1,2'], ['-L', '1,2:a']]);
  // @ts-expect-error Known invalid alternatives cannot be silently discarded.
  git.command(command, [['-L', either]]);
}
for (const command of ['log', 'show'] as const) {
  // A zero start below LONG_MAX keeps a relative end relative; the start is still refused.
  // @ts-expect-error Absolute line numbers start at 1.
  git.command(command, [['-L', '0,-2:a']]);
  git.command(command, [['-L', '9223372036854775806,-2:a']]);
  // @ts-expect-error LONG_MAX itself makes the end absolute.
  git.command(command, [['-L', '9223372036854775807,-2:a']]);
  // @ts-expect-error Leading zeros do not avoid saturation.
  git.command(command, [['-L', '0009223372036854775808,-2:a']]);
}
for (const command of ['log', 'show'] as const) {
  git.command(command, [['--max-count-oldest', 0]]);
  git.command(command, [['--max-count-oldest', 2]]);
  git.command(command, [['--max-count-oldest', -3], ['-n', 2]]);
  git.command(command, [['--max-count-oldest', -3], ['--max-count-oldest', 1]]);
  git.command(command, [['-n', -1]]);
  // @ts-expect-error A negative oldest-first count crashes the walk.
  git.command(command, [['--max-count-oldest', -1]]);
  // @ts-expect-error -n keeps oldest-first mode, so the final count is negative there.
  git.command(command, [['--max-count-oldest', 2], ['-n', -1]]);
}
git.command('diff', [['--since', '2020-01-01']]);
git.command('diff', [['--cached'], ['--since', '2020-01-01'], { operand: 'HEAD' }]);
git.command('diff', [['--cached'], ['--after', 'x'], ['--max-age', -1]]);
git.command('diff', [['--cached'], ['--before', 'x'], ['-h']]);
// @ts-expect-error The HEAD-by-hand index branch refuses a date filter.
git.command('diff', [['--cached'], ['--since', '2020-01-01']]);
// @ts-expect-error An empty date is a date filter too.
git.command('diff', [['--staged'], ['--until', '']]);
git.command('diff', [['--git-completion-helper']]);
git.command('diff', [['--git-completion-helper-all']]);
// @ts-expect-error The typed API accepts a completion word only as the sole argument.
git.command('diff', [['--stat'], ['--git-completion-helper']]);
