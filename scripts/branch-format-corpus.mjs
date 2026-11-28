// Independent native oracle for git branch --format and --sort (ref-filter.c verify_ref_format,
// parse_ref_filter_atom and parse_ref_sorting). Every value runs in list mode with refs to print
// and with a pattern that matches none, so parse-time refusals can be told from those that only
// formatting a ref reaches. The values cross every atom with argument shapes of each atom parser
// and cover the color grammar; they witness the mapping and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-branch-format-'));
const directory = join(base, 'repo');
const env = {
  ...nativeOracleBaseEnv(),
  HOME: base,
  XDG_CONFIG_HOME: base,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  LC_ALL: 'C',
  TZ: 'UTC',
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
  GIT_AUTHOR_DATE: '@1112911993 +0000',
  GIT_COMMITTER_DATE: '@1112911993 +0000',
};
/** Execute native Git with file-backed empty stdin and report abnormal termination. */
function git(args) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error || result.signal) throw result.error ?? new Error(`Git terminated: ${result.signal}`);
    return result;
  } finally {
    closeSync(input);
  }
}
const operand = (value) => ({ operand: value });
/** Refusals of the parse-time checks that the wrapper models. */
const MODELED = [
  /^error: malformed format string %\(/,
  /^error: invalid color value: /,
  /^fatal: malformed field name: /,
  /^fatal: unknown field name: /,
  /^fatal: this command reject atom %\(/,
  /^fatal: %\(.*\) does not take arguments$/,
  /^fatal: unrecognized /,
  /^fatal: expected format: /,
  /^fatal: Integer value expected /,
  /^fatal: positive value expected /,
  /^fatal: positive width expected /,
  /^fatal: expected %\(trailers:key=<value>\)$/,
  /^fatal: unknown %\(trailers\) argument: /,
  /^fatal: argument expected for describe:abbrev$/,
  /^fatal: cannot fully parse describe:abbrev=/,
  /^fatal: value expected describe:(?:match|exclude)=$/,
];
/** Refusals that depend on the repository or on a ref being formatted. */
const STATE = [/^fatal: failed to find '/, /^fatal: format: /, /^fatal: unknown date format /];

const ATOMS = [
  'refname', 'objecttype', 'objectsize', 'objectname', 'deltabase', 'tree', 'parent', 'numparent', 'object', 'type',
  'tag', 'author', 'authorname', 'authoremail', 'authordate', 'committer', 'committername', 'committeremail',
  'committerdate', 'tagger', 'taggername', 'taggeremail', 'taggerdate', 'creator', 'creatordate', 'describe',
  'subject', 'body', 'trailers', 'contents', 'signature', 'raw', 'upstream', 'push', 'symref', 'flag', 'HEAD',
  'color', 'worktreepath', 'align', 'end', 'if', 'then', 'else', 'rest', 'ahead-behind', 'is-base',
];
const ARGS = [
  null, '', 'x', 'short', 'short=0', 'short=1', 'short=-1', 'short= 7', 'short=+7', 'short=4294967295', 'short=4294967296', 'short=', 'short=7x',
  'lstrip=2', 'strip=-1', 'rstrip=x', 'rstrip=', 'lstrip=2147483648', 'lstrip=-2147483648', 'rstrip= +1', 'lstrip=1,track',
  'track', 'trackshort', 'nobracket', 'remotename', 'remoteref', 'track,nobracket', 'track,short', 'short,track', 'track,', ',track', 'Track',
  'disk', 'mailmap', 'trim', 'localpart', 'trim,mailmap', 'trim,', 'trimx', 'trim,localpart,mailmap', 'localpartx,trim',
  'sanitize', 'body', 'size', 'signature', 'subject', 'trailers', 'trailers:', 'trailers:only', 'trailers:only=no', 'trailers:only=maybe',
  'trailers:key', 'trailers:key=', 'trailers:key=a,unfold', 'trailers:separator', 'trailers:separator=%x2c', 'trailers:key_value_separator=:',
  'trailers:keyonly,valueonly=1', 'trailers:,only', 'trailers:only,', 'trailers:bogus', 'lines=3', 'lines=-1', 'lines=', 'lines=0',
  'only', 'unfold=yes', 'key=Signed-off-by', 'key', 'separator=,', 'only=2', 'only=0x10',
  'signer', 'grade', 'key', 'fingerprint', 'primarykeyfingerprint', 'trustlevel',
  'tags', 'tags=no', 'tags=2', 'tags=maybe', 'tags=', 'abbrev', 'abbrev=', 'abbrev=4', 'abbrev=-1', 'abbrev=4x', 'abbrev= 4', 'abbrev=+4',
  'abbrev=99999999999999999999', 'match=v*', 'match=', 'exclude=x', 'tags,abbrev=3', 'tags,,abbrev=3', 'tags,', 'tagsx', 'match',
  '10', '10,left', 'width=10', 'position=right,width=3', 'left', 'middle', 'right,5', '0', '4294967295', 'width=4294967295',
  '4294967296', '10,,left', 'position=up,3', 'width=-1', ' 10', '+10',
  'equals=x', 'notequals=', 'equals', 'main', 'HEAD', 'no-such-commit',
  'red', 'bogus', 'red blue', 'reset', 'bold', 'nobold', 'no-bold',
];
const COLORS = [
  '', ' ', 'red', 'RED', 'Red', 'brightred', 'BrightBlue', 'bright', 'brightdefault', 'default', 'normal', 'NORMAL', 'reset', 'RESET',
  'black', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'grey', 'red blue', 'red blue green', 'red blue bold',
  'bold red blue', 'reset red', 'red reset blue reset', '#fff', '#FFFFFF', '#ffff', '#ggg', '#12345', '#1234567', 'fff',
  '0', '7', '8', '15', '16', '255', '256', '-1', '-2', '+5', '007', '5x', '\v5', '\f5', '99999999999999999999',
  'bold', 'dim', 'italic', 'ul', 'blink', 'reverse', 'strike', 'nobold', 'no-bold', 'no', 'no-', 'nono-bold', 'Bold',
  'red  blue', ' red', 'red ', '\tred\n', 'red\vblue', 'é', 'red,blue', 'underline', 'normal normal', 'normal normal normal',
];
const STRUCTURE = [
  '', 'plain', '%', '%%', '%%(', '%%(x)', '%(', '%(refname', '%(refname))', '%()', '%(*)', '%(**refname)', '%(*refname)',
  '%(*objectname:short)', '%(refname)%(', '%(refname)%', '%(rest)', '%(*rest)', '%(rest:)', '%(Refname)', '%(refname )',
  '%(if)%(refname)%(then)yes%(else)no%(end)', '%(if)%(then)%(end)', '%(end)', '%(then)', '%(else)', '%(if)', '%(if)x%(end)',
  '%(align:10)%(refname)%(end)', '%(align:10)%(refname)', '%(if)%(then)%(then)%(end)', '%(if)%(then)%(else)%(else)%(end)',
  '%(authordate:short)', '%(authordate:bogus)', '%(authordate:format:%Y)', '%(objectname)%(objectname:short=0)',
  '%(color:red)x%(color:reset)', '%(color:)', '%(refname:)', '%(ahead-behind:main)', '%(ahead-behind:missing)', '%(is-base:HEAD)',
  '%x00', '%(refname)\n%(objectname)', '%(%(refname))', '%((refname)', '%(refname:short)%%(foo)',
];

const formats = new Set([
  ...STRUCTURE,
  ...ATOMS.flatMap((atom) => ARGS.map((arg) => (arg === null ? `%(${atom})` : `%(${atom}:${arg})`))),
  ...['objectname', 'subject', 'upstream', 'refname', 'contents'].map((atom) => `%(*${atom})`),
  ...COLORS.map((color) => `%(color:${color})`),
]);
const sorts = new Set([
  '', '-', '--refname', '*', '*refname', 'refname', '-refname', 'v:refname', 'version:refname', '-v:refname', 'v:-refname',
  'version:v:refname', 'V:refname', 'objectname:short)', 'trailers:only)x', 'trailers:only)', 'trailers:bogus)', 'committerdate:bogus',
  'rest', 'HEAD', 'align', 'align:3', 'color:red', 'color:bogus', 'ahead-behind:main', 'ahead-behind:missing', 'is-base:main',
  ...ATOMS.flatMap((atom) => [null, '', 'x', 'short', 'short=0', 'disk', 'mailmap', 'trim', 'track', 'size', '10', 'red', 'equals=x', 'trailers:only'].map((arg) => (arg === null ? atom : `${atom}:${arg}`))),
]);

try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  for (const args of [
    ['init', '-q', '--template=', '-b', 'main'],
    ['commit', '-q', '--allow-empty', '-m', 'one', '-m', 'Signed-off-by: Test <test@example.test>'],
    ['branch', 'topic'],
    ['branch', '--set-upstream-to', 'main', 'topic'],
  ]) {
    if (git(args).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  const cases = [];
  const record = (mode, option, value, tokens) => {
    const argv = ['branch', ...tokens.flatMap((token) => (Array.isArray(token) ? (token.length === 2 ? [`${token[0]}=${token[1]}`] : token) : [token.operand]))];
    const result = git(argv);
    const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    const valid = result.status === 0 && !diagnostic;
    const state = !valid && STATE.some((pattern) => pattern.test(diagnostic));
    if (!valid && !state && !MODELED.some((pattern) => pattern.test(diagnostic))) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    if (mode === 'create' && valid && git(['branch', '-D', 'created']).status !== 0) throw new Error('Cannot reset oracle');
    cases.push({ mode, option, value, tokens, valid, state, diagnostic });
  };
  for (const value of formats) {
    record('refs', 'format', value, [['--format', value]]);
    record('no-refs', 'format', value, [['--format', value], ['--list'], ['--'], operand('no-such-*')]);
  }
  for (const value of sorts) {
    record('refs', 'sort', value, [['--sort', value]]);
    record('no-refs', 'sort', value, [['--sort', value], ['--list'], ['--'], operand('no-such-*')]);
  }
  // Outside list mode Git never parses --format or --sort.
  for (const value of ['%(foo)', '%(', '%(rest)']) {
    record('show-current', 'format', value, [['--show-current'], ['--format', value]]);
    record('create', 'format', value, [['--format', value], ['--'], operand('created')]);
  }
  for (const value of ['foo', '', 'rest:x']) {
    record('show-current', 'sort', value, [['--show-current'], ['--sort', value]]);
    record('create', 'sort', value, [['--sort', value], ['--'], operand('created')]);
  }
  // Filters and an explicit --list select list mode even with operands.
  for (const tokens of [[['--merged', 'main']], [['--contains', 'main']], [['--points-at', 'main']], [['--list'], ['--'], operand('main')]]) {
    record('filter', 'format', '%(foo)', [['--format', '%(foo)'], ...tokens]);
    record('filter', 'sort', 'foo', [['--sort', 'foo'], ...tokens]);
  }
  // Other actions leave list mode; --no-list, --no-sort and --no-format undo an earlier choice.
  for (const tokens of [
    [['--edit-description']],
    [['--set-upstream-to', 'main'], ['--'], operand('topic')],
    [['--unset-upstream'], ['--'], operand('topic')],
    [['-d'], ['--'], operand('created')],
    [['--no-list']],
    [['--list'], ['--no-list'], ['--'], operand('created')],
    [['--no-sort']],
    [['--no-format']],
  ]) {
    for (const [option, value] of [['format', '%(foo)'], ['sort', 'foo']]) {
      if (tokens[0][0] === '-d' && git(['branch', 'created']).status !== 0) throw new Error('Cannot seed oracle');
      record('action', option, value, [[`--${option}`, value], ...tokens]);
      if (git(['branch', '--set-upstream-to', 'main', 'topic']).status !== 0) throw new Error('Cannot reset oracle');
      git(['branch', '-D', 'created']);
    }
  }
  // One case per line keeps the fixture reviewable; argv is the tokens serialized as option=value.
  const header = {
    generator: 'scripts/branch-format-corpus.mjs',
    git: '2.55.0',
    scope: 'Git 2.55.0 git branch --format and --sort in list mode with and without refs to print, and outside list mode',
  };
  const fixture = `${JSON.stringify(header).slice(0, -1)},"cases":[\n${cases.map((row) => JSON.stringify(row)).join(',\n')}\n]}\n`;
  const target = new URL('test/fixtures/branch-format-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('branch-format-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} branch format and sort cases (${cases.filter((row) => row.valid).length} accepted).`);
} finally {
  await rm(base, { recursive: true, force: true });
}
