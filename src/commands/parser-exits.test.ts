import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { CliRunner } from '../runner/cli-runner.js';
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
    // End markers leave literal patterns; the color callback is not reached.
    expect(
      commandArguments('branch', [['--list'], ['--'], { operand: '-h' }, ['--color', 'invalid']]),
    ).toEqual(['branch', '--list', '--', '-h', '--color=invalid']);
    // A literal -h cannot suppress the final creation arity check.
    expect(() =>
      commandArguments('branch', [['--'], ['-h'], { operand: 'two' }, { operand: 'three' }]),
    ).toThrow(GitArgumentError);
    // After the first operand, -h is a literal ref whose resolution belongs to Git.
    expect(commandArguments('show-branch', [{ operand: 'HEAD' }, ['-h']])).toEqual([
      'show-branch',
      'HEAD',
      '-h',
    ]);
    // grep -h means no filename; diff-files does not use the audited exit pass.
    for (const name of ['grep', 'diff-files'] as const) {
      expect((COMMAND_SPECS[name] as { parserExit?: unknown }).parserExit).toBeUndefined();
    }
  });

  it('does not probe parser traits used only after an audited help exit', async () => {
    const adapters = createNodeAdapters();
    adapters.exec.spawn = vi.fn().mockResolvedValue({
      exitCode: 129,
      stderr: 'usage: git clone',
      stdout: '',
      aborted: false,
    });
    const args = [['-h'], ['--filter', 'blob:limit=0b1']] as const;
    const result = await new CliRunner(adapters).runCommand(
      { type: 'global' },
      'clone',
      args,
      false,
      { stdin: 'original input' },
    );
    expect(result.exitCode).toBe(129);
    expect(adapters.exec.spawn).toHaveBeenCalledTimes(1);
    expect(adapters.exec.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['git', 'clone', '-h', '--filter=blob:limit=0b1'],
        stdin: 'original input',
      }),
      undefined,
    );
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
