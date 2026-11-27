/**
 * Refspec words and push options as Git 2.55.0 reads them.
 *
 * builtin/push.c set_refspecs and builtin/fetch.c fetch_one walk the words after the
 * repository: a word `tag` consumes the next word as a tag name and dies when none follows.
 * Under push --delete every other word must be a nonempty name without ':'. cmd_push refuses
 * a command-line push option that contains a newline. clone --origin must pass remote.c
 * valid_remote_name, which parses `refs/heads/test:refs/remotes/<name>/test` as a fetch refspec.
 */
export type PushRefspecParser =
  | 'refspec-operands'
  | 'push-delete-operands'
  | 'refspec-words'
  | 'push-delete-refspecs'
  | 'push-option-text'
  | 'remote-name';

/** Whether the words after the first `skip` words pass the tag shorthand (and delete) checks. */
export function validPushRefspecWords(value: unknown, skip: number, deleting: boolean): boolean {
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
    } else if (deleting && (typeof word !== 'string' || word === '' || word.includes(':'))) {
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

/** refs.c refname_disposition: printable bytes refused outright (4) or as a glob (5). */
const FORBIDDEN_REFNAME_CHARACTERS = ' ~^:?[\\*';

/** Whether a component holds a control byte or a character that refname_disposition refuses. */
function hasForbiddenRefnameCharacter(component: string): boolean {
  for (const character of component) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || FORBIDDEN_REFNAME_CHARACTERS.includes(character)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether Git 2.55.0 valid_remote_name accepts a name. A ':' or '*' in the name breaks the
 * refspec itself; otherwise every '/'-separated component of the name must pass
 * check_refname_component: nonempty, no leading '.', no '..' or '@{', no forbidden byte and no
 * '.lock' suffix. Bytes from 0x80 up are allowed, so non-ASCII text is checked by its code units.
 */
export function validRemoteName(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value
    .split('/')
    .every(
      (component) =>
        component !== '' &&
        !component.startsWith('.') &&
        !component.includes('..') &&
        !component.includes('@{') &&
        !component.endsWith('.lock') &&
        !hasForbiddenRefnameCharacter(component),
    );
}

/** Runtime check for one of the refspec parsers. */
export function parsePushRefspecs(parser: PushRefspecParser, value: unknown): boolean {
  switch (parser) {
    case 'refspec-operands':
      return validPushRefspecWords(value, 1, false);
    case 'push-delete-operands':
      return validPushRefspecWords(value, 1, true);
    case 'refspec-words':
      return validPushRefspecWords(value, 0, false);
    case 'push-delete-refspecs':
      return validPushRefspecWords(value, 0, true);
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
  'push-option-text',
  'remote-name',
];
/** Whether a scalar parser name selects one of the push parsers. */
export function isPushRefspecParser(parser: unknown): parser is PushRefspecParser {
  return typeof parser === 'string' && PARSERS.includes(parser);
}
