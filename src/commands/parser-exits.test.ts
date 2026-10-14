import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/parser-exit-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { GitCommandName } from './types.js';

describe('ordered exits in audited single-pass parsers', () => {
  it('agrees with the independent Git corpus and preserves every serialized word', () => {
    for (const row of corpus.cases) {
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.valid) {
        expect(build(), JSON.stringify(row.argv)).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row.argv)).toThrow(GitArgumentError);
      }
    }
  });

  it('skips ignored callback values, mode conflicts and final semantic constraints', () => {
    expect(commandArguments('branch', [['-h'], ['--track', 'invalid']])).toEqual([
      'branch',
      '-h',
      '--track=invalid',
    ]);
    expect(() => commandArguments('branch', [['--track', 'invalid'], ['-h']])).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('for-each-ref', [['-h'], ['--count', 'garbage']])).toEqual([
      'for-each-ref',
      '-h',
      '--count=garbage',
    ]);
    expect(() => commandArguments('for-each-ref', [['--count', 'garbage'], ['-h']])).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('tag', [['-h'], ['--delete'], ['--verify']])).toEqual([
      'tag',
      '-h',
      '--delete',
      '--verify',
    ]);
    expect(
      commandArguments('show-branch', [['-h'], { operand: '--literal' }, ['--more', 'bad']]),
    ).toEqual(['show-branch', '-h', '--literal', '--more=bad']);
  });

  it('retains the OS representation and token shape checks even for ignored tokens', () => {
    for (const tokens of [
      [['-h'], ['--color', 'a\0b']],
      [['-h'], { operand: 'a\0b' }],
      [['-h'], ['--color', 7]],
      [['-h'], ['--color', 'auto', 'extra']],
      [['-h'], ['--unknown']],
    ]) {
      expect(() => commandArguments('branch', tokens)).toThrow(GitArgumentError);
    }
  });

  it('does not treat a value, a literal operand or another command parser as an exit', () => {
    // A leading --help is dispatched to git-help; it is not this parser's exit.
    expect(() => commandArguments('branch', [['--help'], ['--color', 'invalid']])).toThrow(
      GitArgumentError,
    );
    expect(() =>
      commandArguments('branch', [
        ['--color', '-h'],
        ['--color', 'never'],
      ]),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments('branch', [['--'], { operand: '-h' }, ['--color', 'invalid']]),
    ).toThrow(GitArgumentError);
    expect(() => commandArguments('show-branch', [{ operand: 'HEAD' }, ['-h']])).toThrow(
      GitArgumentError,
    );
    // grep -h means no filename; diff/log have distinct parsing phases.
    for (const name of ['grep', 'diff-files', 'log'] as const) {
      expect((COMMAND_SPECS[name] as { parserExit?: unknown }).parserExit).toBeUndefined();
    }
  });

  it('records color defaults and only the audited help spellings in the schema', () => {
    for (const name of ['branch', 'for-each-ref', 'tag', 'show-branch'] as const) {
      expect(COMMAND_SPECS[name].options['--color'].set).toBe('always');
      expect(COMMAND_SPECS[name].options['--no-color'].set).toBe('never');
      expect(COMMAND_SPECS[name].parserExit.flags).toEqual(['-h', '--help']);
      expect(COMMAND_SPECS[name].parserExit.exceptFirst).toEqual(['--help']);
    }
  });
});
