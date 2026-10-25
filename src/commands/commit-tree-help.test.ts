import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';

describe('commit-tree ordered internal help', () => {
  it('accepts full help and sole completion without a tree', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('commit-tree', [[flag]])).toEqual(['commit-tree', flag]);
    }
    expect(commandArguments('commit-tree', [['-m', 'message'], ['--help']])).toEqual([
      'commit-tree',
      '-m',
      'message',
      '--help',
    ]);
  });
  it('defers parent and file semantics to Git at their parser position', () => {
    for (const flag of ['-p', '-F']) {
      expect(commandArguments('commit-tree', [[flag, 'missing'], ['--help-all']])).toEqual([
        'commit-tree',
        flag,
        'missing',
        '--help-all',
      ]);
      expect(commandArguments('commit-tree', [['--help-all'], [flag, 'missing']])).toEqual([
        'commit-tree',
        '--help-all',
        flag,
        'missing',
      ]);
    }
  });
  it('retains message values and completion ordering', () => {
    expect(() => commandArguments('commit-tree', [['-m', '--help-all']])).toThrow('tree');
    expect(() =>
      commandArguments('commit-tree', [['--git-completion-helper'], ['--help-all']]),
    ).toThrow();
    expect(commandArguments('commit-tree', [['--help-all'], ['--git-completion-helper']])).toEqual([
      'commit-tree',
      '--help-all',
      '--git-completion-helper',
    ]);
  });
  it('retains end-marker, shape and NUL guards', () => {
    expect(commandArguments('commit-tree', [['--'], { operand: '--help-all' }])).toEqual([
      'commit-tree',
      '--',
      '--help-all',
    ]);
    expect(() => commandArguments('commit-tree', [['--'], ['--help-all']])).toThrow();
    expect(() => commandArguments('commit-tree', [['--help-all'], ['--help-all', true]])).toThrow();
    expect(() => commandArguments('commit-tree', [['--help-all'], { operand: '\0' }])).toThrow(
      'NUL',
    );
  });
});
