// Independent native oracle for obligations of the diff, log and show audit closures
// (docs/design/audit-completion.md, spec/command-audit.json).
//
// lineRanges: the -L <range>:<file> syntax (src/constraints/log-line-range.ts). Values are generated from fixed parts: numeric,
// relative, /regex/ and ^ anchors, :funcname forms and file suffixes, crossed so that every
// scan path of line-range.c:skip_range_arg and the argv-determined checks of parse_range_arg
// are reached. Each value runs once with git log and once with git show in one seed
// repository whose file `a` has six lines and a function. Outcomes that depend on the file
// (regular expressions, function names, line counts, missing paths, and the assertion that a
// relative anchor past the end of the file trips) are recorded as state.
// Values ending with a backslash are left out: when a /regex/ scan ends there, Git reads past
// the argument, so the native outcome is undefined (covered by unit tests instead).
//
// counts: sequences of count options. Git parses a negative count in oldest-first mode, and the
// walk then crashes (SIGSEGV) as soon as it yields a commit, so each sequence also runs with a
// pathspec that matches nothing, where the walk yields no commit.
//
// ages: git diff --cached without revisions (the HEAD-by-hand diff-index branch) with a date or
// age filter. Each case also runs under TZ=Asia/Tokyo, where one date text names the second
// before the epoch and leaves the filter at its -1 default.
//
// dash: git diff with a bare - before and after "--"; before it, - is a retained unknown word.
//
// completion: git diff with --git-completion-helper(-all) alone, after and before other words
// and before "--". Git exits on it as the last word before the first "--".
//
// The corpus witnesses the mappings; it is not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-line-range-'));
const directory = join(base, 'repo');
const env = {
  ...nativeOracleBaseEnv(),
  HOME: base,
  XDG_CONFIG_HOME: base,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '0',
  LC_ALL: 'C',
  GIT_PAGER: 'cat',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
};
/** Execute native Git with file-backed empty stdin and report abnormal termination. */
function git(args, extra = {}) {
  const input = openSync(join(base, 'oracle-stdin'), 'r');
  try {
    const result = spawnSync('git', args, { cwd: directory, env: { ...env, ...extra }, stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000 });
    if (result.error) throw result.error;
    // An anchor past the end of the file trips an assertion in line-log.c:nth_line; that
    // depends on the file, so it is recorded with the other file-dependent outcomes. The
    // oldest-first walk crashes on a negative count; that is recorded in counts.
    const assertion = result.signal === 'SIGABRT' && /line-log\.c:\d+: nth_line: Assertion/.test(result.stderr);
    if (result.signal && !assertion && !(result.signal === 'SIGSEGV' && args.some((a) => a.startsWith('--max-count-oldest')))) {
      throw new Error(`Git terminated: ${result.signal} ${JSON.stringify(args)}`);
    }
    return result;
  } finally {
    closeSync(input);
  }
}
/** Argument refusals decided by the -L text alone. */
const SYNTAX = [
  /^fatal: -L argument not 'start,end:file' or ':funcname:file': /,
  /^fatal: -L invalid line number: -?\d+$/,
  /^fatal: -L invalid empty range$/,
];
/** Refusals decided by the file in the commit; the wrapper leaves them to Git. */
const STATE = [
  /^fatal: -L parameter '.*' starting at line \d+: /,
  /^fatal: -L parameter '.*' matches at EOF$/,
  /^fatal: -L parameter '.*': /,
  /^fatal: file .* has only \d+ lines?$/,
  /^fatal: There is no path .* in the commit$/,
  /^SIGABRT: git: line-log\.c:\d+: nth_line: Assertion/,
];
const FIRST = ['', '1', '2', '0', '-1', '+2', '-0', ' 2', '\t-3', '00', '007', '1x', '9999999999999999999999', '9223372036854775806', '9223372036854775807', '^', '^2', '^/b/', '/b/', '/b', '/\\/b/', '/[/', '/zz/', 'x', '+', '-'];
const SECOND = ['', '1', '3', '0', '+0', '-0', '+2', '-2', '+00', ' -1', ' 4', '+ 1', '+x', '/c/', '/c', '^/c/', 'x', '-', '99'];
const SUFFIX = [':a', ':', '', ':missing', '::a', ':a:'];
const NAMES = [':f:a', ':f', '::a', ':', '^:f:a', '^:', ':\\::a', ':f\\:a', ':f\\x:a', ':[:a', ':zz:a', ':f:', ':f:missing', '^:f', 'f:a', ':f:a:b'];
try {
  await writeFile(join(base, 'oracle-stdin'), '');
  await mkdir(directory);
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  await writeFile(join(directory, 'a'), 'a\nb\nc\nf() {\n  d\n}\n');
  for (const args of [['init', '-qb', 'main'], ['add', 'a'], ['commit', '-qm', 'one']]) {
    if (git(args).status !== 0) throw new Error(`Cannot seed oracle: ${args.join(' ')}`);
  }
  // Generated ranges keep their range and file suffix so that tests can relate outcomes.
  const values = new Map(NAMES.map((value) => [value, {}]));
  for (const first of FIRST) {
    for (const suffix of SUFFIX) values.set(`${first}${suffix}`, { range: first, suffix });
    for (const second of SECOND) {
      for (const suffix of SUFFIX.slice(0, 3)) values.set(`${first},${second}${suffix}`, { range: `${first},${second}`, suffix });
    }
  }
  const cases = [];
  const unclassified = new Map();
  for (const [value, parts] of [...values].filter(([v]) => !v.endsWith('\\'))) {
    for (const command of ['log', 'show']) {
      const argv = [command, '--format=%h', '-L', value];
      const result = git(argv);
      const diagnostic = result.signal
        ? `${result.signal}: ${result.stderr.trim()}`
        : (result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '');
      const valid = result.status === 0 && !diagnostic;
      const state = !valid && STATE.some((p) => p.test(diagnostic));
      if (!valid && !state && !SYNTAX.some((p) => p.test(diagnostic))) {
        unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
        continue;
      }
      cases.push({ command, value, ...parts, valid, state, status: result.status, diagnostic });
    }
  }
  const operand = (value) => ({ operand: value });
  /** Spell tokens without importing production serialization: long values attach with '='. */
  const serialize = (tokens) =>
    tokens.flatMap((token) =>
      !Array.isArray(token) ? [token.operand] : token.length === 1 ? token : token[0].startsWith('--') ? [`${token[0]}=${token[1]}`] : token.map(String),
    );
  const COUNTS = [
    [['--max-count-oldest', -2]], [['--max-count-oldest', -1]], [['--max-count-oldest', 0]], [['--max-count-oldest', 1]],
    [['-n', -1]], [['-n', 2]], [['--max-count', -1]], [['--max-count', 1]], [['-3']], [['--skip', 0]], [['--skip', 1]],
  ];
  const sequences = [...COUNTS, ...COUNTS.flatMap((a) => COUNTS.map((b) => [...a, ...b]))];
  const counts = [];
  for (const command of ['log', 'show']) {
    for (const tokens of sequences) {
      for (const pathspec of [[], [['--'], operand('missing')]]) {
        const all = [...tokens, ...pathspec];
        const argv = [command, '--format=%h', ...serialize(all)];
        const result = git(argv);
        const crash = result.signal === 'SIGSEGV';
        const diagnostic = crash
          ? 'SIGSEGV'
          : (result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '');
        const valid = result.status === 0 && !diagnostic;
        if (!valid && !crash && !/^fatal: options '--[a-z-]+' and '--max-count-oldest' cannot be used together$/.test(diagnostic)) {
          unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
          continue;
        }
        counts.push({ command, tokens: all, argv: argv.filter((word) => word !== '--format=%h'), valid, crash, diagnostic });
      }
    }
  }
  const AGES = [
    [['--since', '2020-01-01']], [['--after', 'garbage']], [['--until', '']], [['--before', '1970-01-01 08:59:59']], [['--since', '1970-01-01 08:59:59']],
    [['--max-age', 5]], [['--max-age', -1]], [['--min-age', 0]], [['--since', 'now'], ['--max-age', -1]], [['--max-age', 5], ['--since', 'now']],
  ];
  const ages = [];
  for (const age of AGES) {
    for (const tail of [[], [operand('HEAD')], [['-h']]]) {
      for (const zone of ['UTC', 'Asia/Tokyo']) {
        const tokens = [['--cached'], ...age, ...tail];
        const argv = ['diff', ...serialize(tokens)];
        const result = git(argv, { TZ: zone });
        const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
        // -h prints usage to stdout with exit 129; both are argument exits.
        const valid = result.status === 0 && !diagnostic;
        const help = result.status === 129 && /^usage: git diff /.test(result.stdout);
        if (!valid && !help && !/^usage: git diff /.test(diagnostic)) {
          unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
          continue;
        }
        ages.push({ command: 'diff', tokens, argv, zone, valid, help, diagnostic: help ? 'help' : diagnostic });
      }
    }
  }
  const dash = [];
  for (const tokens of [
    [operand('-')], [operand('HEAD'), operand('-')], [operand('-'), ['-h']], [['-h'], operand('-')], [['--cached'], operand('-')],
    [['--'], operand('-')], [operand('-'), ['-S', '--no-index']], [['-S', 'x'], operand('-')], [operand('-'), ['--'], operand('a')],
  ]) {
    const argv = ['diff', ...serialize(tokens)];
    const result = git(argv);
    const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
    const valid = result.status === 0 && !diagnostic;
    if (!valid && !/^(error: invalid option: -$|usage: git diff )/.test(diagnostic)) {
      unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
      continue;
    }
    dash.push({ command: 'diff', tokens, argv, valid, diagnostic });
  }
  const completion = [];
  for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
    for (const tokens of [
      [[word]], [['--stat'], [word]], [[word], ['--stat']], [operand('HEAD'), [word]], [[word], ['--'], operand('a')],
      [['--stat', 'bad'], [word]], [['-h'], [word]], [[word], ['-h']], [['--'], operand(word)],
    ]) {
      const argv = ['diff', ...serialize(tokens)];
      const result = git(argv);
      const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
      const valid = result.status === 0 && !diagnostic;
      if (!valid && !/^(error: invalid option: |error: invalid --stat value: |usage: git diff )/.test(diagnostic)) {
        unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
        continue;
      }
      completion.push({ command: 'diff', tokens, argv, valid, diagnostic });
    }
  }
  // diff --no-index parses its options with parse_options over the diff table, where the
  // completion words end in usage instead of a successful exit.
  for (const word of ['--git-completion-helper', '--git-completion-helper-all']) {
    for (const tokens of [[[word]], [[word], operand('a'), operand('a')], [['--stat'], [word], operand('a'), operand('a')]]) {
      const argv = ['diff', '--no-index', ...serialize(tokens)];
      const result = git(argv);
      const diagnostic = result.stderr.split('\n').find((line) => /^(usage|fatal|error):/.test(line)) ?? '';
      const valid = result.status === 0 && !diagnostic;
      if (valid || result.status !== 129) {
        unclassified.set(diagnostic || `${result.status}: ${result.stderr}`, argv);
        continue;
      }
      completion.push({ command: 'diff --no-index', tokens, argv, valid, diagnostic });
    }
  }
  if (unclassified.size) {
    throw new Error(`Unclassified outcomes:\n${[...unclassified].map(([d, argv]) => `${JSON.stringify(argv)}: ${d}`).join('\n')}`);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        "Git 2.55.0; one commit whose file a is 'a, b, c, f() {, d, }'; git log and git show with --format=%h. lineRanges: -L <value>, values crossing numeric, relative, /regex/ and ^ anchors with file suffixes, plus :funcname forms; values ending with a backslash are excluded (undefined native behavior). counts: single count options and ordered pairs, each without and with '-- missing'. ages: diff --cached with date and age filters, alone, with HEAD and with -h, under TZ=UTC and TZ=Asia/Tokyo. completion: git diff completion words in nine positions, and git diff --no-index completion words alone, before two paths and after another option. dash: git diff with a bare - in nine positions. Empty file-backed stdin",
      lineRanges: cases,
      counts,
      ages,
      completion,
      dash,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/diff-log-show-closure-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('diff-log-show-closure-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} -L, ${counts.length} count, ${ages.length} age, ${completion.length} completion and ${dash.length} dash outcomes.`);
} finally {
  await rm(base, { recursive: true, force: true });
}
