// Enumerate the refusal sites of named C functions in the pinned Git source.
//
// A complete audit closure (spec/command-audit.json, "closure") lists the functions it
// audited and maps every refusal site in them to a disposition. This extractor is the
// source-side half of that check: import-refusal-sites.mjs records its output in
// spec/upstream/git-refusal-sites.json, verify-upstream.mjs reproduces that snapshot from
// the pinned source, and command-coverage.mjs compares every closure with the snapshot.
// It is deliberately syntactic: it finds call sites and same-file function references; it
// does not decide which of them are reachable from argv. BUG() is an internal invariant,
// not a refusal, and is not listed.

/** Calls that end the command, print usage or report an error back to it. */
export const REFUSAL_CALLS = [
  'die',
  'die_errno',
  'die_message',
  'die_message_errno',
  'die_for_incompatible_opt2',
  'die_for_incompatible_opt3',
  'die_for_incompatible_opt4',
  'usage',
  'usagef',
  'usage_with_options',
  'usage_msg_opt',
  'usage_msg_optf',
  'show_usage_if_asked',
  'show_usage_with_options_if_asked',
  'error',
  'error_errno',
  'error_with_usage',
  'exit',
];

/** Offset just past the string or char literal starting at `start`. */
function literalEnd(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote && source[i] !== '\n') {
    i += source[i] === '\\' ? 2 : 1;
  }
  return i + 1;
}

/**
 * Two offset-preserving views of the source: `code` blanks comments only, `scan` also
 * blanks the contents of string and char literals so text inside them never reads as a
 * call or a brace.
 */
export function views(source) {
  let code = '';
  let scan = '';
  for (let i = 0; i < source.length; ) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      const blank = source.slice(i, stop).replace(/[^\n]/g, ' ');
      code += blank;
      scan += blank;
      i = stop;
    } else if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      code += ' '.repeat(stop - i);
      scan += ' '.repeat(stop - i);
      i = stop;
    } else if (c === '"' || c === "'") {
      const stop = literalEnd(source, i);
      code += source.slice(i, stop);
      scan += c + ' '.repeat(Math.max(0, stop - i - 2)) + source[stop - 1];
      i = stop;
    } else {
      code += c;
      scan += c;
      i += 1;
    }
  }
  return { code, scan };
}

/** Offset of the bracket matching the opener at `start` in a literal-blanked text. */
function matching(scan, start) {
  const open = scan[start];
  const close = { '(': ')', '{': '}' }[open];
  let depth = 0;
  for (let i = start; i < scan.length; i += 1) {
    if (scan[i] === open) depth += 1;
    else if (scan[i] === close && --depth === 0) return i;
  }
  throw new Error(`Unbalanced ${open} at offset ${start}`);
}

/** Names of all top-level function definitions in a literal-blanked text. */
export function definedFunctions(scan) {
  const names = new Set();
  for (const match of scan.matchAll(/^(?:[A-Za-z_][^;{}()\n=]*?[\s*])?([A-Za-z_]\w*)\s*\(/gm)) {
    const params = match.index + match[0].length - 1;
    const after = matching(scan, params) + 1;
    if (/^\s*\{/.test(scan.slice(after))) names.add(match[1]);
  }
  return names;
}

/** Body offsets of the top-level definition of `name`; throw when missing or ambiguous. */
export function functionBody(scan, name) {
  const pattern = new RegExp(`^(?:[A-Za-z_][^;{}()\\n=]*?[\\s*])?${name}\\s*\\(`, 'gm');
  const bodies = [];
  for (const match of scan.matchAll(pattern)) {
    const params = match.index + match[0].length - 1;
    const after = matching(scan, params) + 1;
    const rest = scan.slice(after).match(/^\s*\{/);
    if (!rest) continue; // a prototype
    const open = after + rest[0].length - 1;
    bodies.push({ start: open, end: matching(scan, open) + 1 });
  }
  if (bodies.length !== 1) throw new Error(`${name}: expected one definition, found ${bodies.length}`);
  return bodies[0];
}

/** Decode one C string literal body; escapes are read left to right. */
const decode = (body) =>
  body.replace(/\\(.)/g, (_, c) => ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[c] ?? `\\${c}`);

/**
 * The message alternatives of one argument: adjacent literals concatenate, and a top-level
 * conditional yields one alternative per branch. A non-literal argument is kept as its
 * normalized expression in angle brackets.
 */
function messages(argument) {
  const inner = unwrap(argument.trim());
  if (inner !== argument.trim()) return messages(inner);
  const parts = splitTopLevel(argument, '?');
  if (parts.length === 2) {
    const [, branches] = parts;
    const [yes, no] = splitTopLevel(branches, ':');
    if (no !== undefined) return [...messages(yes), ...messages(no)];
  }
  const literals = [...argument.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => decode(m[1]));
  if (literals.length) return [literals.join('')];
  return [`<${argument.replace(/\s+/g, ' ').trim()}>`];
}

/** The expression inside parentheses that enclose all of `text`, or `text` itself. */
function unwrap(text) {
  if (!text.startsWith('(')) return text;
  const { scan } = views(text);
  return matching(scan, 0) === text.length - 1 ? text.slice(1, -1).trim() : text;
}

/** Split at the first top-level occurrence of `separator`, ignoring literals and brackets. */
function splitTopLevel(text, separator) {
  const { scan } = views(text);
  let depth = 0;
  for (let i = 0; i < scan.length; i += 1) {
    const c = scan[i];
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === separator && depth === 0) return [text.slice(0, i), text.slice(i + 1)];
  }
  return [text];
}

/** Split a call's argument list at top-level commas, using the blanked view for structure. */
function splitArguments(code, scan) {
  const args = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < scan.length; i += 1) {
    const c = scan[i];
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) {
      args.push(code.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (code.slice(start).trim()) args.push(code.slice(start).trim());
  return args;
}

/** Whether an argument is exactly one C string literal (possibly wrapped in _() or N_()). */
const isLiteral = (arg) => /^(?:N?_\()?\s*"(?:[^"\\\n]|\\.)*"\s*\)?$/.test(arg);

/** Text of the call's diagnostic, or null for calls that carry none. */
function siteTexts(call, args) {
  if (call.startsWith('die_for_incompatible_opt')) {
    return [args.filter((_, i) => i % 2 === 1).map((arg) => messages(arg).join('|')).join(' / ')];
  }
  if (call === 'usage_with_options' || call === 'show_usage_with_options_if_asked' || call === 'show_usage_if_asked') {
    return [null];
  }
  if (call === 'exit') return [`exit ${args[0] ?? ''}`.trim()];
  const formats = messages(args[0] ?? '');
  // Literal format arguments ("--long", "-z") tell apart sites sharing one format.
  const literals = args.slice(1).map((arg) => (isLiteral(arg) ? messages(arg)[0] : null));
  const suffix = literals.some((l) => l !== null) ? ` [${literals.map((l) => l ?? '*').join(', ')}]` : '';
  return formats.map((format) => format + suffix);
}

/**
 * Refusal sites of one function, in source order. `text` is the diagnostic format for
 * message calls (one site per conditional branch), the option names for
 * die_for_incompatible_optN, the status for exit, and null for usage calls without a
 * message. `line` is 1-based in the original file.
 */
export function refusalSites(source, name) {
  const { code, scan } = views(source);
  const body = functionBody(scan, name);
  const text = scan.slice(body.start, body.end);
  const pattern = new RegExp(`\\b(${REFUSAL_CALLS.join('|')})\\s*\\(`, 'g');
  const sites = [];
  for (const match of text.matchAll(pattern)) {
    // Skip member accesses and identifiers that merely end with a call name.
    const before = text[match.index - 1];
    if (before && /[\w.>]/.test(before)) continue;
    const open = body.start + match.index + match[0].length - 1;
    const close = matching(scan, open);
    const args = splitArguments(code.slice(open + 1, close), scan.slice(open + 1, close));
    const line = code.slice(0, body.start + match.index).split('\n').length;
    for (const site of siteTexts(match[1], args)) {
      sites.push({ function: name, call: match[1], text: site, line });
    }
  }
  return sites;
}

/**
 * Same-file functions that a function calls or references (option callbacks appear as
 * bare identifiers in option tables). A closure must list each of them or waive it.
 */
export function referencedFunctions(source, name) {
  const { scan } = views(source);
  const defined = definedFunctions(scan);
  const body = functionBody(scan, name);
  const found = new Set();
  for (const match of scan.slice(body.start, body.end).matchAll(/\b[A-Za-z_]\w*\b/g)) {
    if (match[0] !== name && defined.has(match[0])) found.add(match[0]);
  }
  return [...found].sort();
}
