/**
 * Refspec words and push options as Git 2.55.0 reads them.
 *
 * builtin/push.c set_refspecs and builtin/fetch.c fetch_one walk the words after the
 * repository: a word `tag` consumes the next word as a tag name and dies when none follows.
 * Under push --delete every other word must be a nonempty name without ':'. Every word, or the
 * refspec it expands to (`refs/tags/<tag>` for push, `:refs/tags/<tag>` under --delete, `:<name>`
 * for a deleted name, `refs/tags/<tag>:refs/tags/<tag>` for fetch), goes to refspec.c
 * parse_refspec at once, which dies on an invalid one before any transport runs. cmd_push refuses a command-line push option that contains
 * a newline. clone --origin must pass remote.c valid_remote_name, which parses
 * `refs/heads/test:refs/remotes/<name>/test` as a fetch refspec.
 */
import { validRefnameFormat } from './refname.js';

export type PushRefspecParser =
  | 'refspec-operands'
  | 'push-delete-operands'
  | 'refspec-words'
  | 'push-delete-refspecs'
  | 'fetch-refspec-operands'
  | 'fetch-refspec-words'
  | 'push-option-text'
  | 'remote-name';

/** Which caller expands the words: push, push --delete, or fetch (and pull, which runs it). */
type RefspecMode = 'push' | 'delete' | 'fetch';

/** A full object name; whether it counts as one depends on the repository's hash. */
const FULL_OBJECT_NAME = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/**
 * refspec.c parse_refspec: whether a push (`fetch` false) or fetch refspec parses. A negative
 * refspec spelled as a full object name is refused only for the repository's hash length, so it
 * is left to Git.
 */
export function validRefspec(refspec: string, fetch: boolean): boolean {
  let lhs = refspec;
  let negative = false;
  if (lhs.startsWith('+')) {
    lhs = lhs.slice(1);
  } else if (lhs.startsWith('^')) {
    negative = true;
    lhs = lhs.slice(1);
  }
  const colon = lhs.lastIndexOf(':');
  if (negative && colon >= 0) {
    return false;
  }
  if (!fetch && lhs === ':') {
    return true;
  }
  const dst = colon >= 0 ? lhs.slice(colon + 1) : undefined;
  const left = colon >= 0 ? lhs.slice(0, colon) : lhs;
  let glob = dst !== undefined && dst.includes('*');
  if (left.includes('*')) {
    if ((dst !== undefined && !glob) || (dst === undefined && !negative && fetch)) {
      return false;
    }
    glob = true;
  } else if (glob) {
    return false;
  }
  const src = left === '@' ? 'HEAD' : left;
  const valid = (name: string): boolean => validRefnameFormat(name, true, glob);
  if (negative) {
    return src !== '' && (FULL_OBJECT_NAME.test(src) || valid(src));
  }
  if (fetch) {
    return (src === '' || valid(src)) && (dst === undefined || dst === '' || valid(dst));
  }
  if (src !== '' && glob && !valid(src)) {
    return false;
  }
  if (dst === undefined) {
    return valid(src);
  }
  return dst !== '' && valid(dst);
}

/** Whether the words after the first `skip` words pass the tag shorthand (and delete) checks. */
export function validRefspecWords(value: unknown, skip: number, mode: RefspecMode): boolean {
  const words = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(words)) {
    return false;
  }
  for (let index = skip; index < words.length; index++) {
    const word = words[index];
    if (word === 'tag') {
      index++;
      if (index >= words.length) {
        return false;
      }
      const tag = words[index];
      if (typeof tag !== 'string') {
        continue;
      }
      const refspec =
        mode === 'fetch'
          ? `refs/tags/${tag}:refs/tags/${tag}`
          : `${mode === 'delete' ? ':' : ''}refs/tags/${tag}`;
      if (!validRefspec(refspec, mode === 'fetch')) {
        return false;
      }
    } else if (mode === 'delete') {
      if (
        typeof word !== 'string' ||
        word === '' ||
        word.includes(':') ||
        !validRefspec(`:${word}`, false)
      ) {
        return false;
      }
    } else if (typeof word === 'string' && !validRefspec(word, mode === 'fetch')) {
      // A push word without ':' that uniquely names a local branch is mapped instead, but such
      // a word is a valid ref name and parses either way.
      return false;
    }
  }
  return true;
}

/** Whether every command-line push option is free of newline characters. */
export function validPushOptionText(value: unknown): boolean {
  const items = typeof value === 'string' ? [value] : value;
  return (
    Array.isArray(items) && items.every((item) => typeof item !== 'string' || !item.includes('\n'))
  );
}

/**
 * Whether Git 2.55.0 valid_remote_name accepts a name. It parses
 * `refs/heads/test:refs/remotes/<name>/test` as a fetch refspec: a ':' or '*' in the name breaks
 * the refspec, and the right side must pass check_refname_format, which refuses both as well.
 */
export function validRemoteName(value: unknown): boolean {
  return typeof value === 'string' && validRefnameFormat(`refs/remotes/${value}/test`);
}

/** Runtime check for one of the refspec parsers. */
export function parsePushRefspecs(parser: PushRefspecParser, value: unknown): boolean {
  switch (parser) {
    case 'refspec-operands':
      return validRefspecWords(value, 1, 'push');
    case 'push-delete-operands':
      return validRefspecWords(value, 1, 'delete');
    case 'refspec-words':
      return validRefspecWords(value, 0, 'push');
    case 'push-delete-refspecs':
      return validRefspecWords(value, 0, 'delete');
    case 'fetch-refspec-operands':
      return validRefspecWords(value, 1, 'fetch');
    case 'fetch-refspec-words':
      return validRefspecWords(value, 0, 'fetch');
    case 'push-option-text':
      return validPushOptionText(value);
    case 'remote-name':
      return validRemoteName(value);
  }
}

const PARSERS: readonly string[] = [
  'refspec-operands',
  'push-delete-operands',
  'refspec-words',
  'push-delete-refspecs',
  'fetch-refspec-operands',
  'fetch-refspec-words',
  'push-option-text',
  'remote-name',
];
/** Whether a scalar parser name selects one of the push parsers. */
export function isPushRefspecParser(parser: unknown): parser is PushRefspecParser {
  return typeof parser === 'string' && PARSERS.includes(parser);
}
