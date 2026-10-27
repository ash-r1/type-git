import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('rev-parse full usage and flag passthrough', () => {
  it('accepts a sole canonical full-help flag', () => {
    expect(commandArguments('rev-parse', [['--help-all']])).toEqual(['rev-parse', '--help-all']);
  });
  it('retains multiword flag and ordinary revision behavior', () => {
    expect(commandArguments('rev-parse', [['--help-all'], { operand: 'HEAD' }])).toEqual([
      'rev-parse',
      '--help-all',
      'HEAD',
    ]);
    expect(commandArguments('rev-parse', [['--verify'], ['--help-all']])).toEqual([
      'rev-parse',
      '--verify',
      '--help-all',
    ]);
  });
  it('does not turn multiword full-help into a parser exit', () => {
    for (const args of [
      [['--help-all'], ['--path-format', 'invalid']],
      [['--path-format', 'invalid'], ['--help-all']],
      [['--help-all'], ['--not-a-rev-parse-option']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
    ]) {
      expect(() => commandArguments('rev-parse', args)).toThrow();
    }
    expect(() => commandArguments('rev-parse', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});
