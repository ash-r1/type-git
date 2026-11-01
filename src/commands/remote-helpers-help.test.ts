import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('remote helper sole usage words', () => {
  for (const command of ['remote-fd', 'remote-ext'] as const) {
    it(`${command} accepts sole usage and ordinary two-word shapes`, () => {
      for (const flag of ['-h', '--help-all']) {
        expect(commandArguments(command, [[flag]])).toEqual([command, flag]);
        expect(commandArguments(command, [{ operand: flag }])).toEqual([command, flag]);
        expect(commandArguments(command, [{ operand: flag }, { operand: 'target' }])).toEqual([
          command,
          flag,
          'target',
        ]);
      }
      expect(commandArguments(command, [{ operand: 'fixture' }, { operand: 'target' }])).toEqual([
        command,
        'fixture',
        'target',
      ]);
    });
    it(`${command} rejects missing URL, extra operands and non-sole canonical usage`, () => {
      for (const args of [
        [],
        [{ operand: 'fixture' }],
        [['-h'], { operand: 'target' }],
        [['--help-all'], { operand: 'target' }],
        [{ operand: 'fixture' }, { operand: 'target' }, { operand: 'extra' }],
        [{ operand: 'fixture' }, ['--help']],
      ]) {
        expect(() => commandArguments(command, args)).toThrow();
      }
    });
    it(`${command} retains first documentation help and structural guards`, () => {
      expect(commandArguments(command, [['--help'], ['--man']])).toEqual([
        command,
        '--help',
        '--man',
      ]);
      expect(() => commandArguments(command, [['--']])).toThrow();
      expect(() => commandArguments(command, [['--git-completion-helper']])).toThrow();
      expect(() => commandArguments(command, [['-h', true]])).toThrow();
      expect(() => commandArguments(command, [['-h'], { operand: '\0' }])).toThrow('NUL');
    });
  }
});
