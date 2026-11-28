/**
 * Git 2.55.0 ref-filter.c format and sort grammar as `git branch` checks it before listing:
 * verify_ref_format (atoms, their arguments and the rejected %(rest)) and ref_sorting_options
 * (sort keys). Argument checks that run only while a ref is formatted (date formats, the
 * %(if)/%(then)/%(else)/%(end) stack, commit lookups) are left to Git.
 */
import { asciiLower } from './ascii.js';
import { gitBoolean } from './git-boolean.js';

/** libc isspace, which strtol and strtoul skip before the number. */
const LIBC_SPACE = '[ \\t\\n\\v\\f\\r]*';
const STRTOL_I = new RegExp(`^${LIBC_SPACE}([+-]?[0-9]+)$`);
const STRTOUL_UI = new RegExp(`^${LIBC_SPACE}\\+?([0-9]+)$`);
const STRTOL_PREFIX = new RegExp(`^${LIBC_SPACE}([+-]?[0-9]+)`);
/** git-compat-util sane_ctype isspace: space, tab, LF and CR. */
const GIT_SPACE = /[ \t\n\r]/;
/** pretty.c match_placeholder_arg_value ends a value at ',' or ')'. */
const PLACEHOLDER_END = /[,)]/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const INT_MIN = -2147483648n;
const INT_MAX = 2147483647n;
const UINT_MAX = 4294967295n;

/** git-compat-util strtol_i: the whole text is a base-10 int. */
function strtolI(text: string): boolean {
  const match = STRTOL_I.exec(text);
  if (!match) {
    return false;
  }
  const value = BigInt(match[1] as string);
  return value >= INT_MIN && value <= INT_MAX;
}

/** git-compat-util strtoul_ui: no '-' anywhere, and the whole text is a base-10 unsigned int. */
function strtoulUiValue(text: string): bigint | undefined {
  if (text.includes('-')) {
    return undefined;
  }
  const match = STRTOUL_UI.exec(text);
  if (!match) {
    return undefined;
  }
  const value = BigInt(match[1] as string);
  return value <= UINT_MAX ? value : undefined;
}

function strtoulUi(text: string): boolean {
  return strtoulUiValue(text) !== undefined;
}

/** color.c match_word: ASCII case-insensitive whole-word comparison. */
function matchWord(word: string, name: string): boolean {
  return word.length === name.length && asciiLower(word) === name;
}

const ANSI_COLORS = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const ATTRIBUTES = ['bold', 'dim', 'italic', 'ul', 'blink', 'reverse', 'strike'];

/** color.c parse_color: normal, #rgb, ANSI names (bright prefix), or -1 to 255. */
function parseColor(word: string): boolean {
  if (matchWord(word, 'normal') || HEX_COLOR.test(word) || matchWord(word, 'default')) {
    return true;
  }
  const name = asciiLower(word.slice(0, 6)) === 'bright' ? word.slice(6) : word;
  if (ANSI_COLORS.some((color) => matchWord(name, color))) {
    return true;
  }
  // strtol must consume the whole word; it skips libc space such as VT and FF first.
  const match = STRTOL_PREFIX.exec(word);
  if (!match || match[0].length !== word.length) {
    return false;
  }
  const value = BigInt(match[1] as string);
  return value >= -1n && value < 256n;
}

/** color.c parse_attr: an attribute, optionally negated by "no" or "no-". */
function parseAttribute(word: string): boolean {
  let name = word;
  if (name.startsWith('no')) {
    name = name.slice(2);
    if (name.startsWith('-')) {
      name = name.slice(1);
    }
  }
  return ATTRIBUTES.includes(name);
}

/** color.c color_parse_mem: [reset] [fg [bg]] [attr]..., separated by Git spaces. */
export function validGitColor(value: string): boolean {
  let foreground = false;
  let background = false;
  for (const word of value.split(GIT_SPACE)) {
    if (word === '' || matchWord(word, 'reset')) {
      continue;
    }
    if (parseColor(word)) {
      if (!foreground) {
        foreground = true;
      } else if (!background) {
        background = true;
      } else {
        return false;
      }
      continue;
    }
    if (!parseAttribute(word)) {
      return false;
    }
  }
  return true;
}

type ArgParser = (arg: string | undefined) => boolean;

const anyArg: ArgParser = () => true;
const noArg: ArgParser = (arg) => arg === undefined;
const requiredArg: ArgParser = (arg) => arg !== undefined;
const oneOf =
  (...choices: string[]): ArgParser =>
  (arg) =>
    arg === undefined || choices.includes(arg);

/** refname_atom_parser_internal: short, lstrip=/strip=<int>, rstrip=<int>. */
const refnameArg: ArgParser = (arg) => {
  if (arg === undefined || arg === 'short') {
    return true;
  }
  for (const prefix of ['lstrip=', 'strip=', 'rstrip=']) {
    if (arg.startsWith(prefix)) {
      return strtolI(arg.slice(prefix.length));
    }
  }
  return false;
};

/** remote_ref_atom_parser: every comma item is a keyword or the whole argument is a refname option. */
const remoteRefArg: ArgParser = (arg) =>
  arg === undefined ||
  arg
    .split(',')
    .every(
      (item) =>
        ['track', 'trackshort', 'nobracket', 'remotename', 'remoteref'].includes(item) ||
        refnameArg(arg),
    );

/** oid_atom_parser: short or short=<positive unsigned int>. */
const oidArg: ArgParser = (arg) => {
  if (arg === undefined || arg === 'short') {
    return true;
  }
  if (!arg.startsWith('short=')) {
    return false;
  }
  const value = strtoulUiValue(arg.slice('short='.length));
  return value !== undefined && value !== 0n;
};

/** person_email_atom_parser: comma-separated prefixes trim, localpart and mailmap. */
const emailArg: ArgParser = (arg) => {
  if (arg === undefined) {
    return true;
  }
  let rest = arg;
  for (;;) {
    const option = ['trim', 'localpart', 'mailmap'].find((name) => rest.startsWith(name));
    if (option === undefined) {
      return false;
    }
    rest = rest.slice(option.length);
    if (rest === '') {
      return true;
    }
    if (!rest.startsWith(',')) {
      return false;
    }
    rest = rest.slice(1);
  }
};

type Matched = { value: string | undefined; rest: string };

/** ref-filter.c match_atom_arg_value: "candidate[=value]" ended by ',' or the end. */
function matchAtomArgValue(text: string, candidate: string): Matched | undefined {
  if (!text.startsWith(candidate)) {
    return undefined;
  }
  const after = text.slice(candidate.length);
  if (after.startsWith('=')) {
    const comma = after.indexOf(',');
    const value = comma < 0 ? after.slice(1) : after.slice(1, comma);
    return { value, rest: comma < 0 ? '' : after.slice(comma + 1) };
  }
  if (after !== '' && !after.startsWith(',')) {
    return undefined;
  }
  return { value: undefined, rest: after.slice(1) };
}

/** describe_atom_parser: tags[=<bool>], abbrev=<n>, match=<pattern>, exclude=<pattern>. */
const describeArg: ArgParser = (arg) => {
  let rest = arg ?? '';
  while (rest !== '') {
    const tags = matchAtomArgValue(rest, 'tags');
    if (tags) {
      // match_atom_bool_arg moves past "tags=<value>" even when the value is not a boolean,
      // so the remaining options are tried on what follows: tags=bogus,match=v* works.
      rest = tags.rest;
      if (tags.value === undefined || gitBoolean(tags.value) !== undefined) {
        continue;
      }
    }
    const abbrev = matchAtomArgValue(rest, 'abbrev');
    if (abbrev) {
      // strtol must be non-negative and consume the whole value.
      const value = abbrev.value ?? '';
      const match = STRTOL_PREFIX.exec(value);
      if (!match || match[0].length !== value.length || BigInt(match[1] as string) < 0n) {
        return false;
      }
      rest = abbrev.rest;
      continue;
    }
    const pattern = matchAtomArgValue(rest, 'match') ?? matchAtomArgValue(rest, 'exclude');
    if (!pattern?.value) {
      return false;
    }
    rest = pattern.rest;
  }
  return true;
};

/** pretty.c match_placeholder_arg_value on text that ends with ')'. */
function matchPlaceholder(text: string, candidate: string): Matched | undefined {
  if (!text.startsWith(candidate)) {
    return undefined;
  }
  let after = text.slice(candidate.length);
  let value: string | undefined;
  if (after.startsWith('=')) {
    const end = after.slice(1).search(PLACEHOLDER_END);
    value = after.slice(1, end + 1);
    after = after.slice(end + 1);
  } else if (!(after.startsWith(',') || after.startsWith(')'))) {
    return undefined;
  }
  return { value, rest: after.startsWith(',') ? after.slice(1) : after };
}

/** pretty.c format_set_trailers_options, which stops at the first ')'. */
function trailersOptions(arg: string): boolean {
  let rest = `${arg})`;
  while (!rest.startsWith(')')) {
    const key = matchPlaceholder(rest, 'key');
    if (key) {
      if (key.value === undefined) {
        return false;
      }
      rest = key.rest;
      continue;
    }
    const separator =
      matchPlaceholder(rest, 'separator') ?? matchPlaceholder(rest, 'key_value_separator');
    if (separator) {
      rest = separator.rest;
      continue;
    }
    // match_placeholder_bool_arg moves past a matched name even when its value is not a
    // boolean, so the next candidate is tried on the text after it: only=bogus,unfold works.
    let matched = false;
    for (const name of ['only', 'unfold', 'keyonly', 'valueonly']) {
      const flag = matchPlaceholder(rest, name);
      if (!flag) {
        continue;
      }
      rest = flag.rest;
      if (flag.value === undefined || gitBoolean(flag.value) !== undefined) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return false;
    }
  }
  return true;
}

const trailersArg: ArgParser = (arg) => arg === undefined || trailersOptions(arg);

/** contents_atom_parser. */
const contentsArg: ArgParser = (arg) => {
  if (arg === undefined || ['body', 'size', 'signature', 'subject', 'trailers'].includes(arg)) {
    return true;
  }
  if (arg.startsWith('trailers:')) {
    return trailersOptions(arg.slice('trailers:'.length));
  }
  if (arg.startsWith('lines=')) {
    return strtoulUi(arg.slice('lines='.length));
  }
  return false;
};

const ALIGN_POSITIONS = ['right', 'middle', 'left'];

/** align_atom_parser: width and position items; a width is required and is not UINT_MAX. */
const alignArg: ArgParser = (arg) => {
  if (arg === undefined) {
    return false;
  }
  let width = UINT_MAX;
  for (const item of arg.split(',')) {
    if (item.startsWith('position=')) {
      if (!ALIGN_POSITIONS.includes(item.slice('position='.length))) {
        return false;
      }
    } else if (item.startsWith('width=')) {
      const value = strtoulUiValue(item.slice('width='.length));
      if (value === undefined) {
        return false;
      }
      width = value;
    } else {
      const value = strtoulUiValue(item);
      if (value !== undefined) {
        width = value;
      } else if (!ALIGN_POSITIONS.includes(item)) {
        return false;
      }
    }
  }
  return width !== UINT_MAX;
};

const colorArg: ArgParser = (arg) => arg !== undefined && validGitColor(arg);
const ifArg: ArgParser = (arg) =>
  arg === undefined || arg.startsWith('equals=') || arg.startsWith('notequals=');
const nameArg = oneOf('mailmap');

/** valid_atom[] with each atom's parse-time argument parser; atoms without one take any argument. */
const ATOMS: ReadonlyMap<string, ArgParser> = new Map<string, ArgParser>([
  ['refname', refnameArg],
  ['objecttype', noArg],
  ['objectsize', oneOf('disk')],
  ['objectname', oidArg],
  ['deltabase', noArg],
  ['tree', oidArg],
  ['parent', oidArg],
  ['numparent', anyArg],
  ['object', anyArg],
  ['type', anyArg],
  ['tag', anyArg],
  ['author', anyArg],
  ['authorname', nameArg],
  ['authoremail', emailArg],
  ['authordate', anyArg],
  ['committer', anyArg],
  ['committername', nameArg],
  ['committeremail', emailArg],
  ['committerdate', anyArg],
  ['tagger', anyArg],
  ['taggername', nameArg],
  ['taggeremail', emailArg],
  ['taggerdate', anyArg],
  ['creator', anyArg],
  ['creatordate', anyArg],
  ['describe', describeArg],
  ['subject', oneOf('sanitize')],
  ['body', noArg],
  ['trailers', trailersArg],
  ['contents', contentsArg],
  [
    'signature',
    oneOf('signer', 'grade', 'key', 'fingerprint', 'primarykeyfingerprint', 'trustlevel'),
  ],
  ['raw', oneOf('size')],
  ['upstream', remoteRefArg],
  ['push', remoteRefArg],
  ['symref', refnameArg],
  ['flag', anyArg],
  ['HEAD', noArg],
  ['color', colorArg],
  ['worktreepath', anyArg],
  ['align', alignArg],
  ['end', anyArg],
  ['if', ifArg],
  ['then', anyArg],
  ['else', anyArg],
  ['rest', noArg],
  // The committish is looked up in the repository, which Git decides.
  ['ahead-behind', requiredArg],
  ['is-base', requiredArg],
]);

/** parse_ref_filter_atom: an optional '*', a known name, and an argument its parser accepts. */
function parseAtom(atom: string): string | undefined {
  const start = atom.startsWith('*') ? 1 : 0;
  if (atom.length <= start) {
    return undefined;
  }
  const colon = atom.indexOf(':', start);
  const name = atom.slice(start, colon < 0 ? undefined : colon);
  const parser = ATOMS.get(name);
  // At parse time "%(atom:)" is the same as "%(atom)"; atoms that read the argument
  // later (dates, for example) may still refuse it while printing.
  const arg = colon < 0 || colon === atom.length - 1 ? undefined : atom.slice(colon + 1);
  return parser?.(arg) ? name : undefined;
}

/** verify_ref_format: every "%(" needs a ')' and a valid atom; branch rejects %(rest). */
export function validRefFormat(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  let index = 0;
  while (index < value.length) {
    if (value[index] !== '%') {
      index += 1;
      continue;
    }
    if (value[index + 1] === '%') {
      index += 2;
      continue;
    }
    if (value[index + 1] !== '(') {
      index += 1;
      continue;
    }
    const end = value.indexOf(')', index);
    if (end < 0) {
      return false;
    }
    const name = parseAtom(value.slice(index + 2, end));
    if (name === undefined || name === 'rest') {
      return false;
    }
    index = end + 1;
  }
  return true;
}

/** parse_ref_sorting: optional '-', optional "version:" or "v:", then an atom. */
export function validRefSortKey(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  let key = value.startsWith('-') ? value.slice(1) : value;
  for (const prefix of ['version:', 'v:']) {
    if (key.startsWith(prefix)) {
      key = key.slice(prefix.length);
      break;
    }
  }
  return parseAtom(key) !== undefined;
}
