import { describe, expect, it } from 'vitest';
import { validStringCallback } from '../constraints/string-callback.js';
import { commandArguments } from './build.js';

const flags = [
  '--output-indicator-new',
  '--output-indicator-old',
  '--output-indicator-context',
] as const;
describe('diff output indicator bytes and callback reachability', () => {
  it('accepts one ASCII byte and delegates empty argv to native Git', () => {
    for (const value of ['', '+', ' ', '\t', '\n', '\x01', '\x7f']) {
      expect(validStringCallback('diff-output-indicator', value)).toBe(true);
      for (const flag of flags) {
        expect(commandArguments('diff', [[flag, value]])).toContain(`${flag}=${value}`);
      }
    }
    for (const value of ['ab', 'é', '😀', '\ud800']) {
      expect(validStringCallback('diff-output-indicator', value)).toBe(false);
      for (const flag of flags) {
        expect(() => commandArguments('diff', [[flag, value]])).toThrow();
      }
    }
  });
  it('keeps native parser phases and ignored-tail shape checks', () => {
    for (const flag of flags) {
      expect(() => commandArguments('diff', [['-h'], [flag, 'é']])).toThrow();
      expect(() => commandArguments('blame', [[flag, 'é'], ['-h']])).toThrow();
      expect(commandArguments('blame', [['-h'], [flag, 'é']])).toContain(`${flag}=é`);
      expect(commandArguments('log', [[flag, 'é'], ['-h']])).toContain(`${flag}=é`);
      expect(commandArguments('difftool', [[flag, 'é'], ['--tool-help']])).toContain(`${flag}=é`);
      expect(() =>
        commandArguments('difftool', [[flag, 'é'], ['--tool-help'], ['--no-tool-help']]),
      ).toThrow();
      expect(() => commandArguments('log', [['-h'], [flag, '\0']])).toThrow();
      expect(() => commandArguments('log', [['-h'], [flag]])).toThrow();
    }
  });
});
