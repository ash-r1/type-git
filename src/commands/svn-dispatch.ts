/** Result of git-svn.perl's scan of raw words before GetOptions consumes values. */
export type SvnDispatch =
  | { kind: 'command'; command: string; index: number; remaining: readonly string[] }
  | { kind: 'help'; command: string | undefined }
  | { kind: 'none' };

/** Select the first registered command, even inside detached option values or after --. */
export function svnDispatch(
  words: readonly string[],
  commands: Readonly<Record<string, string>>,
): SvnDispatch {
  for (const [index, word] of words.entries()) {
    if (Object.hasOwn(commands, word)) {
      return {
        kind: 'command',
        command: commands[word]!,
        index,
        remaining: [...words.slice(0, index), ...words.slice(index + 1)],
      };
    }
    if (word === 'help') {
      return { kind: 'help', command: words[index + 1] };
    }
  }
  return { kind: 'none' };
}

/** Reconstruct detached GetOptions arguments after removing the selected command word. */
export function svnParserTokens(
  words: readonly string[],
  options: Readonly<Record<string, { value: string }>>,
): readonly unknown[] | undefined {
  const tokens: unknown[] = [];
  let ended = false;
  let index = 0;
  while (index < words.length) {
    const word = words[index++]!;
    if (ended || !word.startsWith('-') || word === '-') {
      tokens.push({ operand: word });
      continue;
    }
    if (word === '--') {
      tokens.push(['--']);
      ended = true;
      continue;
    }
    const equals = word.startsWith('--') ? word.indexOf('=') : -1;
    const flag = equals < 0 ? word : word.slice(0, equals);
    if (!Object.hasOwn(options, flag)) {
      return undefined;
    }
    const option = options[flag]!;
    if (option.value === 'flag') {
      if (equals >= 0) {
        return undefined;
      }
      tokens.push([flag]);
    } else if (equals >= 0) {
      tokens.push([flag, word.slice(equals + 1)]);
    } else if (!option.value.startsWith('optional-')) {
      const value = words[index++];
      if (value === undefined) {
        return undefined;
      }
      tokens.push([flag, value]);
    } else {
      // Getopt::Long optional values supplied by this API use equals spelling.
      // With no equals, retain the flag and let following words remain operands.
      tokens.push([flag]);
    }
  }
  return tokens;
}
