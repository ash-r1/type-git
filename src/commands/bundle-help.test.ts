import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

for (const command of [
  'bundle create',
  'bundle verify',
  'bundle list-heads',
  'bundle unbundle',
] as const) {
  describe(`${command} stopped option parser usage`, () => {
    it('retains ignored words after help without admitting unknown prefix options', () => {
      for (const help of ['-h', '--help', '--help-all']) {
        expect(commandArguments(command, [[help], ['--type-git-tail']])).toEqual([
          ...command.split(' '),
          help,
          '--type-git-tail',
        ]);
        expect(() => commandArguments(command, [['--type-git-prefix'], [help]])).toThrow();
        expect(() => commandArguments(command, [{ operand: 'missing.bundle' }, [help]])).toThrow();
        expect(() => commandArguments(command, [['--'], [help], ['--type-git-tail']])).toThrow();
      }
    });
    it('recognizes sole completion words and preserves public representation boundaries', () => {
      for (const completion of ['--git-completion-helper', '--git-completion-helper-all']) {
        expect(commandArguments(command, [[completion]])).toEqual([
          ...command.split(' '),
          completion,
        ]);
        expect(() => commandArguments(command, [[completion], ['-h']])).toThrow();
        expect(commandArguments(command, [['-h'], [completion]])).toContain(completion);
      }
      expect(() => commandArguments(command, [['-h', true]])).toThrow();
      expect(() => commandArguments(command, [['-h'], ['--type-git-tail', '\0']])).toThrow();
    });
  });
}

it('keeps bundle version callback errors distinct from deferred format checks', () => {
  expect(commandArguments('bundle create', [['-h'], ['--version', 'invalid']])).toEqual([
    'bundle',
    'create',
    '-h',
    '--version=invalid',
  ]);
  expect(commandArguments('bundle create', [['--version', 4], ['--help-all']])).toContain(
    '--version=4',
  );
  expect(() => commandArguments('bundle create', [['--version', 'invalid'], ['-h']])).toThrow();
  expect(() =>
    commandArguments('bundle create', [['--version', 'invalid'], ['--version', 3], ['-h']]),
  ).toThrow();
  expect(() => commandArguments('bundle create', [['-h'], ['--version']])).toThrow();
});
