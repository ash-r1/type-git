import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('merge-ours canonical help word and ignored arguments', () => {
  it('accepts the canonical flag without normalizing its native behavior', () => {
    expect(commandArguments('merge-ours', [['--help-all']])).toEqual(['merge-ours', '--help-all']);
    expect(commandArguments('merge-ours', [['--help-all'], { operand: 'ignored' }])).toEqual([
      'merge-ours',
      '--help-all',
      'ignored',
    ]);
  });
  it('retains ignored conventional and option-looking literal words', () => {
    expect(
      commandArguments('merge-ours', [
        { operand: 'base' },
        { operand: '--' },
        { operand: 'HEAD' },
        { operand: 'remote' },
      ]),
    ).toEqual(['merge-ours', 'base', '--', 'HEAD', 'remote']);
    expect(commandArguments('merge-ours', [{ operand: '--git-completion-helper' }])).toEqual([
      'merge-ours',
      '--git-completion-helper',
    ]);
  });
  it('keeps parser and serialization guards', () => {
    expect(() => commandArguments('merge-ours', [['--']])).toThrow();
    expect(() => commandArguments('merge-ours', [['--help-all', true]])).toThrow();
    expect(() => commandArguments('merge-ours', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
    expect(() => commandArguments('merge-ours', [['--git-completion-helper']])).toThrow();
  });
});
