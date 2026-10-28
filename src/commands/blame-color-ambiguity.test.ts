import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

for (const command of ['blame', 'annotate', 'pickaxe'] as const) {
  describe(`${command} ambiguous color option`, () => {
    it('rejects every reached ambiguous spelling before help', () => {
      for (const option of [['--color'], ['--color', 'always'], ['--color', 'invalid']]) {
        expect(() => commandArguments(command, [option, ['-h']])).toThrow('ambiguous');
      }
      expect(commandArguments(command, [['--color-lines'], ['-h']])).toEqual([
        command,
        '--color-lines',
        '-h',
      ]);
    });
    it('preserves ignored color words after a proven native exit', () => {
      expect(commandArguments(command, [['-h'], ['--color', 'invalid']])).toEqual([
        command,
        '-h',
        '--color=invalid',
      ]);
      expect(commandArguments(command, [['-h'], ['--color']])).toEqual([command, '-h', '--color']);
    });
    it('retains representation guards in ignored words', () => {
      expect(() => commandArguments(command, [['-h'], ['--color', '\0']])).toThrow('NUL');
      expect(() => commandArguments(command, [['-h'], ['--color', 42]])).toThrow();
    });
  });
}
