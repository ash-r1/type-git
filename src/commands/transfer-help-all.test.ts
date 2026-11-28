import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

// Git 2.55.0 parse-options.c:parse_options_step handles an exact --help-all internally for
// clone, fetch, pull and push, at any position, and exits 129 with the full usage.
describe('transfer --help-all', () => {
  for (const command of ['clone', 'fetch', 'pull', 'push'] as const) {
    it(`keeps --help-all for ${command}`, () => {
      expect(commandArguments(command, [['--help-all']] as never, true)).toEqual([
        command,
        '--help-all',
      ]);
      expect(commandArguments(command, [['--quiet'], ['--help-all']] as never, true)).toEqual([
        command,
        '--quiet',
        '--help-all',
      ]);
    });
  }
});
