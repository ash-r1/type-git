/**
 * Refspec words and push options as Git 2.55.0 reads them.
 *
 * builtin/push.c set_refspecs and builtin/fetch.c fetch_one walk the words after the
 * repository: a word `tag` consumes the next word as a tag name and dies when none follows.
 * Under push --delete every other word must be a nonempty name without ':'. The words they
 * expand to (`refs/tags/<tag>` for push, `:refs/tags/<tag>` under --delete, `:<name>` for a
 * deleted name, `refs/tags/<tag>:refs/tags/<tag>` for fetch) go to refspec.c parse_refspec at
 * once, which dies on an invalid one. cmd_push refuses a command-line push option that contains
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

/**
 * refspec.c parse_refspec for a refspec that set_refspecs or fetch_one built. These never start
 * with '+' or '^', and their source is never `@` or a full object name.
 */
function validExpandedRefspec(refspec: string, fetch: boolean): boolean {
  const colon = refspec.lastIndexOf(':');
  if (!fetch && refspec === ':') {
    return true;
  }
  const dst = colon >= 0 ? refspec.slice(colon + 1) : undefined;
  const src = colon >= 0 ? refspec.slice(0, colon) : refspec;
  let glob = dst !== undefined && dst.includes('*');
  if (src.includes('*')) {
    if ((dst !== undefined && !glob) || (dst === undefined && fetch)) {
      return false;
    }
    glob = true;
  } else if (glob) {
    return false;
  }
  const valid = (name: string): boolean => validRefnameFormat(name, true, glob);
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
      if (!validExpandedRefspec(refspec, mode === 'fetch')) {
        return false;
      }
    } else if (
      mode === 'delete' &&
      (typeof word !== 'string' ||
        word === '' ||
        word.includes(':') ||
        !validExpandedRefspec(`:${word}`, false))
    ) {
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
