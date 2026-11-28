// Independent native oracle for the --author and --date values that Git 2.55.0
// builtin/commit.c:determine_author_info refuses (split_ident_line and fmt_ident for --author,
// parse_force_date for --date). Every value runs as a real empty commit and as a dry run in a
// repository reset to its seed. The values cover every ASCII byte except NUL in the name
// position and as a whole date, the word lists of date.c and their prefixes; they witness the
// mapping and are not a completeness argument.
import { spawnSync } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeOracleBaseEnv } from './native-oracle-env.mjs';

const root = new URL('../', import.meta.url);
const base = await mkdtemp(join(tmpdir(), 'type-git-commit-ident-'));
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
  // date.c:get_time reads the clock from here, so relative dates are reproducible.
  GIT_TEST_DATE_NOW: String(Date.UTC(2026, 10, 1) / 1000),
  GIT_PAGER: 'cat',
  GIT_EDITOR: 'true',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
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
/** Diagnostics of the modeled refusal sites. */
const AUTHOR = [/^fatal: malformed --author parameter$/, /^fatal: empty ident name \(for <.*>\) not allowed$/, /^fatal: name consists only of disallowed characters: /];
/** parse_force_date names the value; ident.c names the '@<seconds>' that approxidate produced. */
const DATE_RANGE = /^fatal: invalid date format: @\d+$/;
/** A value without '>' names an existing author, which only the repository decides. */
const NICKNAME = /^fatal: --author '.*' is not 'Name <email>' and matches no existing author$/;

const ascii = [];
for (let code = 1; code < 128; code += 1) ascii.push(String.fromCharCode(code));
const AUTHORS = [
  'A <a@example.test>', 'A<a>', '<a>', ' <a>', '\t<a>', 'A <>', 'A <a', 'A >a<', 'a>b<c', 'x>', '>', '<>', 'A <a>>',
  'A <a> x', 'A <<a>>', 'é <a>', '日本 <a>', ',;: <a>', '"\'\\ <a>', 'a\v <a>', '\v <a>', 'A\n <a>', 'nickname', '',
  ...ascii.map((character) => `${character} <a@example.test>`),
  ...ascii.map((character) => `${character}A <a>`),
];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = ['yesterday', 'noon', 'midnight', 'tea', 'pm', 'am', 'never', 'now', 'today', 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'last', 'seconds', 'second', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'year', 'sunday', 'fridays', 'fri', 'ago'];
// date.c special[] (never excluded), number_name[1..10] and last.
const TOUCHING = ['yesterday', 'noon', 'midnight', 'tea', 'pm', 'am', 'now', 'today', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'last'];
const DATES = [
  '', ' ', 'x', '-', '@', 'é', '日本', 'jan.', '.jan', 'x jan', 'jan,x', 'janx', 'Jan', 'JAN', 'friday last', 'last friday', 'ten years', 'noon x', 'x-now',
  'jan never', 'never today', 'today never', 'never noon', 'last never', 'never-yesterday', 'nevers', 'é never',
  'never ten years', 'never one year', 'never last friday', 'never yesterday', 'never ten days', 'never ten years ten years', 'never ten months',
  'never ten hours', 'never ten weeks', 'never one second', 'never friday', 'never last year', 'never noon yesterday', 'never ten', 'never pm',
  Array(8).fill('ten years').join(' ').replace(/^/, 'never '),
  `never${' jan yesterday'.repeat(70)}`, `never${' jan yesterday'.repeat(71)}`,
  '1', 'x1', '1x', '@1', '2005-04-07T22:13:13', 'Thu, 07 Apr 2005 22:13:13 +0200', '@1112911993 +0200', '1112911993', '1.year.ago', '1971', '200 years ago',
  ...ascii,
  ...MONTHS.flatMap((month) => [month.slice(0, 2), month.slice(0, 3), month, `${month}x`, month.toUpperCase()]),
  ...WORDS.flatMap((word) => [word, word.toUpperCase(), `${word}x`]),
];
try {
  await mkdir(directory);
  await writeFile(join(base, 'oracle-stdin'), '');
  if (git(['--version']).stdout.trim() !== 'git version 2.55.0') throw new Error('The oracle requires Git 2.55.0');
  if (git(['init', '-q', '--template=', '-b', 'main']).status !== 0 || git(['commit', '-q', '--allow-empty', '-m', 'seed']).status !== 0) throw new Error('Cannot seed oracle');
  const seed = git(['rev-parse', 'HEAD']).stdout.trim();
  const cases = [];
  const record = (option, value, dryRun) => {
    if (git(['reset', '-q', '--hard', seed]).status !== 0) throw new Error('Cannot reset oracle');
    const tokens = [['--allow-empty'], ['-m', 'msg'], [option, value], ...(dryRun ? [['--dry-run']] : [])];
    const argv = ['commit', '--allow-empty', '-m', 'msg', `${option}=${value}`, ...(dryRun ? ['--dry-run'] : [])];
    const result = git(argv);
    const diagnostic = result.stderr.split('\n').find((line) => /^(fatal|error):/.test(line)) ?? '';
    // A dry run exits 1 when nothing would be committed; that is still a well-formed call.
    const valid = (result.status === 0 || (dryRun && result.status === 1)) && !diagnostic;
    const state = !valid && NICKNAME.test(diagnostic);
    // ident.c re-parses the '@<seconds>' that approxidate computed from the clock and time zone.
    // Only text with a digit, or "never" followed by a word that touches (date_never resets every
    // field, so only later words can move the result), reaches that arithmetic; other digit-free
    // refusals are modeled.
    const words = (value.match(/[A-Za-z]+/g) ?? []).map((word) => word.toLowerCase());
    const touches = (word) => TOUCHING.includes(word) || (word.length >= 3 && MONTHS.some((month) => month.startsWith(word)));
    const never = words.lastIndexOf('never');
    const arithmetic = /[0-9]/.test(value) || (never >= 0 && words.slice(never + 1).some(touches));
    const environment =
      !valid && option === '--date' && arithmetic && DATE_RANGE.test(diagnostic) && diagnostic !== `fatal: invalid date format: ${value}`;
    // die() prints control characters as '?', so the value itself is not matched.
    const modeled = option === '--author' ? AUTHOR : [/^fatal: invalid date format: /];
    if (!valid && !state && !environment && !modeled.some((pattern) => pattern.test(diagnostic))) {
      throw new Error(`Unclassified ${JSON.stringify(argv)}: ${result.status}: ${result.stderr}`);
    }
    // The seconds come from the clock, so they are not recorded.
    const recorded = DATE_RANGE.test(diagnostic) && diagnostic !== `fatal: invalid date format: ${value}` ? 'fatal: invalid date format: @<seconds>' : diagnostic;
    cases.push({ command: 'commit', tokens, argv, valid, state, environment, status: result.status, diagnostic: recorded });
  };
  for (const dryRun of [false, true]) {
    for (const value of new Set(AUTHORS)) record('--author', value, dryRun);
    for (const value of new Set(DATES)) record('--date', value, dryRun);
  }
  const fixture = `${JSON.stringify(
    {
      profile:
        'Git 2.55.0; TZ=UTC; clock GIT_TEST_DATE_NOW=2026-11-01T00:00:00Z; isolated repository reset to its seed commit before every case; real empty commits and dry runs with --author or --date; empty file-backed stdin',
      cases,
    },
    null,
    2,
  )}\n`;
  const target = new URL('test/fixtures/commit-ident-corpus.json', root);
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8').catch(() => '')) !== fixture) throw new Error('commit-ident-corpus.json is stale');
  } else await writeFile(target, fixture);
  console.log(`Generated/checked ${cases.length} independent commit author and date outcomes (${cases.filter((row) => row.valid).length} accepted).`);
} finally {
  await rm(base, { recursive: true, force: true });
}
