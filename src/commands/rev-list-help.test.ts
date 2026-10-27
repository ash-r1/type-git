import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('rev-list sole full usage', () => {
  it('accepts the canonical sole full-help flag', () => {
    expect(commandArguments('rev-list', [['--help-all']])).toEqual(['rev-list', '--help-all']);
  });
  it('retains ordinary revision arguments', () => {
    expect(commandArguments('rev-list', [['--count'], { operand: 'HEAD' }])).toEqual([
      'rev-list',
      '--count',
      'HEAD',
    ]);
    expect(commandArguments('rev-list', [['--max-count', 1], { operand: 'HEAD' }])).toEqual([
      'rev-list',
      '--max-count=1',
      'HEAD',
    ]);
  });
  it('retains sole-word, callback, representation, and NUL boundaries', () => {
    for (const args of [
      [['--help-all'], { operand: 'HEAD' }],
      [['--count'], ['--help-all']],
      [['--help-all'], ['--disk-usage', 'invalid']],
      [['--disk-usage', 'invalid'], ['--help-all']],
      [['--help-all', true]],
      [{ operand: '--help-all' }],
    ]) {
      expect(() => commandArguments('rev-list', args)).toThrow();
    }
    expect(() => commandArguments('rev-list', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});
