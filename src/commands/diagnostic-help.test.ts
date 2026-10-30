import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

for (const [command, mode] of [
  ['bugreport', '--diagnose'],
  ['diagnose', '--mode'],
] as const) {
  describe(`${command} diagnostic callback help`, () => {
    it('ignores callback values and unknown words only after reached help', () => {
      for (const help of ['-h', '--help-all']) {
        expect(commandArguments(command, [[help], [mode, 'invalid'], ['--type-git-tail']])).toEqual(
          [command, help, `${mode}=invalid`, '--type-git-tail'],
        );
        expect(() => commandArguments(command, [[mode, 'invalid'], [help]])).toThrow();
        expect(() =>
          commandArguments(command, [[mode, 'invalid'], [mode, 'stats'], [help]]),
        ).toThrow();
        expect(() => commandArguments(command, [['--type-git-prefix'], [help]])).toThrow();
        expect(commandArguments(command, [[mode, 'stats'], [help], [mode, 'invalid']])).toContain(
          `${mode}=invalid`,
        );
      }
      expect(commandArguments(command, [[mode, 'stats'], ['--help'], [mode, 'invalid']])).toContain(
        `${mode}=invalid`,
      );
    });
    it('keeps sole-word completion and public representation boundaries', () => {
      for (const completion of ['--git-completion-helper', '--git-completion-helper-all']) {
        expect(commandArguments(command, [[completion]])).toEqual([command, completion]);
        expect(() => commandArguments(command, [[completion], ['-h']])).toThrow();
        expect(commandArguments(command, [['-h'], [completion]])).toContain(completion);
      }
      expect(() => commandArguments(command, [['-h'], [mode, '\0']])).toThrow();
      expect(() => commandArguments(command, [['-h', true]])).toThrow();
      expect(() => commandArguments(command, [['-h'], [mode, 'stats', 'extra']])).toThrow();
      if (command === 'diagnose') {
        expect(() => commandArguments(command, [['-h'], [mode]])).toThrow();
      }
    });
  });
}
