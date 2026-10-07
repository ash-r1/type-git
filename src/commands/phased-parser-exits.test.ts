import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/phased-parser-exit-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('initial parser exits before deferred revision/diff callbacks', () => {
  it('matches the independent Git corpus without reordering the serialized argv', () => {
    for (const row of corpus.cases) {
      const build = () => commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.valid) {
        expect(build(), JSON.stringify(row.argv)).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row.argv)).toThrow(GitArgumentError);
      }
    }
  });

  it('keeps value shape and NUL checks for deferred and post-exit tokens', () => {
    for (const tokens of [
      [['--color', 'bad\0'], ['-h']],
      [['--color', 7], ['-h']],
      [['-h'], ['--decorate', 'bad\0']],
      [['--color', 'bad'], ['-h'], { operand: 'bad\0' }],
      [['--unknown'], ['-h']],
      [{ operand: '--decorate=bad' }, ['-h']],
    ]) {
      expect(() => commandArguments('log', tokens)).toThrow(GitArgumentError);
    }
  });

  it('generates first-pass recognition from the source tables including aliases and negation', () => {
    expect(COMMAND_SPECS.log.parserExit.firstPassOptions).toEqual(
      expect.arrayContaining([
        '--decorate',
        '--no-decorate',
        '--mailmap',
        '--no-mailmap',
        '-q',
        '-L',
        '-h',
      ]),
    );
    expect(COMMAND_SPECS.log.parserExit.firstPassOptions).not.toContain('--color');
    expect(COMMAND_SPECS['fast-export'].parserExit.firstPassOptions).toContain('--progress');
    expect(COMMAND_SPECS['cherry-pick'].parserExit.firstPassOptions).toContain('--empty');
    expect(COMMAND_SPECS.revert.parserExit.firstPassOptions).not.toContain('--empty');
  });
  it('does not mistake consumed help or either boundary for an initial-pass exit', () => {
    expect(initialParserPass(COMMAND_SPECS.log, ['-G', '-L', '-h'])).toEqual({
      exited: false,
      tokens: [['-L', '-h']],
      remaining: ['-G'],
    });
    for (const boundary of ['--', '--end-of-options']) {
      expect(initialParserPass(COMMAND_SPECS.log, ['--default', boundary, '-h']).exited).toBe(
        false,
      );
    }
  });
});
