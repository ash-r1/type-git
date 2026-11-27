/**
 * Values that Git 2.55.0 builtin/commit.c:determine_author_info refuses for a real commit
 * (not for --dry-run or a status format, which return before prepare_to_commit).
 */

/** git-compat-util sane_ctype isspace: space, tab, LF and CR (not VT or FF). */
const GIT_SPACE = /[ \t\n\r]+$/;

/** ident.c crud(): bytes Git strips from both ends of an ident name or email. */
function crud(code: number): boolean {
  return (
    code <= 32 ||
    code === 0x2c ||
    code === 0x3a ||
    code === 0x3b ||
    code === 0x3c ||
    code === 0x3e ||
    code === 0x22 ||
    code === 0x5c ||
    code === 0x27
  );
}

/**
 * An --author value containing '>' is split by ident.c:split_ident_line, which needs a '<'
 * with a '>' after it ("malformed --author parameter"); fmt_ident(IDENT_STRICT) then refuses
 * an empty name ("empty ident name not allowed") and a name of crud only ("name consists
 * only of disallowed characters"). A value without '>' is looked up among existing authors
 * (find_author_by_nickname), which only the repository decides.
 */
export function validCommitAuthor(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (!value.includes('>')) {
    return true;
  }
  const open = value.indexOf('<');
  if (open < 0 || value.indexOf('>', open + 1) < 0) {
    return false;
  }
  const name = value.slice(0, open).replace(GIT_SPACE, '');
  // Non-ASCII UTF-16 units encode to bytes >= 0x80, which are not crud.
  return [...name].some((character) => !crud(character.charCodeAt(0)));
}

const DIGIT = /[0-9]/;
const ASCII_WORDS = /[A-Za-z]+/g;
const MONTHS: readonly string[] = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
/**
 * date.c special[], number_name[1..10] and "last": whole words, ASCII case-insensitive. "never"
 * touches too, but is refused separately below.
 */
const NUMBERS: ReadonlySet<string> = new Set([
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'last',
]);
const WORDS: ReadonlySet<string> = new Set([
  ...NUMBERS,
  'yesterday',
  'noon',
  'midnight',
  'tea',
  'pm',
  'am',
  'now',
  'today',
]);

/**
 * builtin/commit.c:parse_force_date refuses --date ("invalid date format") when
 * date.c:parse_date fails and approxidate_careful touches nothing. parse_date_basic needs a
 * digit to set a year, and approxidate_str touches on any digit, so only digit-free text can
 * fail. Its words are runs of ASCII letters (sane_ctype; bytes >= 0x80 separate words); a word
 * touches when it is a month prefix of at least three letters, a special word, one to ten or
 * "last". Units, weekdays, "months" and "years" touch only after a number, which has already
 * touched. date_never sets every field to the epoch; without a number word, the remaining
 * digit-free words only keep fields that are already set or move back in time, so such a value
 * yields seconds below 100000000, which ident.c refuses in every clock and time zone. With a
 * number word, repeated units can wrap tm_year past 1973 (eight "ten years" after "never"
 * reach 2026), which is clock arithmetic left to Git like the digit case.
 */
export function validCommitDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (DIGIT.test(value)) {
    return true;
  }
  const words = (value.match(ASCII_WORDS) ?? []).map((word) => word.toLowerCase());
  if (words.includes('never')) {
    return words.some((lower) => NUMBERS.has(lower));
  }
  return words.some((lower) => {
    return (
      WORDS.has(lower) || (lower.length >= 3 && MONTHS.some((month) => month.startsWith(lower)))
    );
  });
}
