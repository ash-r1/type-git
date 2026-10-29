import { describe, expect, it } from 'vitest';
import { validCompoundDecimal } from '../constraints/compound-decimal.js';
import { commandArguments } from './build.js';

describe('pack index version parsers', () => {
  it('preserves unsigned casts and distinct comma handling', () => {
    for (const parser of ['pack-objects-index-version', 'index-pack-index-version'] as const) {
      for (const text of [
        '',
        '0',
        '1',
        '2',
        '+1',
        ' 1',
        ',1',
        '4294967296',
        '1,0x10',
        '1,010',
        '1,4294967296',
        '1,-4294967296',
      ]) {
        expect(validCompoundDecimal(parser, text, 64), `${parser} ${text}`).toBe(true);
      }
      for (const text of [
        '3',
        'bad',
        '1k',
        '1 ',
        '1,08',
        '1,-1',
        '1,2147483648',
        '1,4294967295',
        '1,1,1',
        '1, ',
        '1,+',
        '1,0x',
        '1,١',
      ]) {
        expect(validCompoundDecimal(parser, text, 64), `${parser} ${text}`).toBe(false);
      }
      expect(validCompoundDecimal(parser, '4294967296', 32)).toBe(false);
      expect(validCompoundDecimal(parser, '1,4294967296', 32)).toBe(false);
      expect(validCompoundDecimal(parser, '1,0b10', 64, false, true)).toBe(true);
      expect(validCompoundDecimal(parser, '1,0b10', 64, false, false)).toBe(false);
      expect(validCompoundDecimal(parser, '1,-18446744073709551616', 64, false)).toBe(false);
      expect(validCompoundDecimal(parser, '1,-18446744073709551616', 64, true)).toBe(true);
    }
    expect(validCompoundDecimal('pack-objects-index-version', '1,')).toBe(false);
    expect(validCompoundDecimal('index-pack-index-version', '1,')).toBe(true);
    expect(validCompoundDecimal('index-pack-index-version', ',')).toBe(true);
    expect(validCompoundDecimal('pack-objects-index-version', `1,${' '.repeat(1100)}0`)).toBe(true);
  });

  it('checks reached values before later help and preserves argv', () => {
    for (const command of ['pack-objects', 'index-pack'] as const) {
      for (const value of ['3', 'bad', '1,08', '1,2147483648']) {
        expect(() => commandArguments(command, [['--index-version', value], ['-h']])).toThrow();
        expect(commandArguments(command, [['-h'], ['--index-version', value]])).toContain('-h');
      }
      expect(commandArguments(command, [['--index-version', '1,0x10'], ['-h']])).toContain(
        '--index-version=1,0x10',
      );
      expect(() =>
        commandArguments(command, [['--index-version', 'bad'], ['--index-version', '1'], ['-h']]),
      ).toThrow();
      expect(() => commandArguments(command, [['-h'], ['--index-version', '1\0']])).toThrow();
    }
  });
});
