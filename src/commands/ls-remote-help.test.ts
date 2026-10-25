import { describe, expect, it } from 'vitest';
import { commandArguments } from './build.js';
describe('ls-remote ordered internal help', () => {
  it('accepts full help and sole completion', () => {
    for (const flag of ['--help-all', '--git-completion-helper', '--git-completion-helper-all']) {
      expect(commandArguments('ls-remote', [[flag]])).toEqual(['ls-remote', flag]);
    }
  });
  it('retains multiword heads and reached completion errors', () => {
    expect(commandArguments('ls-remote', [['--get-url'], ['-h'], { operand: 'local' }])).toEqual([
      'ls-remote',
      '--get-url',
      '-h',
      'local',
    ]);
    expect(() => commandArguments('ls-remote', [['-h'], ['--git-completion-helper']])).toThrow();
  });
  it('allows a help exit before a multiword completion token', () => {
    expect(commandArguments('ls-remote', [['--help-all'], ['--git-completion-helper']])).toEqual([
      'ls-remote',
      '--help-all',
      '--git-completion-helper',
    ]);
  });
  it('does not interpret consumed values or late literal operands as help', () => {
    expect(() =>
      commandArguments('ls-remote', [['--upload-pack', '--help-all'], ['--git-completion-helper']]),
    ).toThrow();
    expect(
      commandArguments('ls-remote', [
        ['--get-url'],
        { operand: 'local' },
        { operand: '--help-all' },
      ]),
    ).toEqual(['ls-remote', '--get-url', 'local', '--help-all']);
    expect(() =>
      commandArguments('ls-remote', [['--get-url'], { operand: 'local' }, ['--help-all']]),
    ).toThrow('first operand');
  });
  it('retains representation guards after help', () => {
    expect(() => commandArguments('ls-remote', [['--help-all'], ['--refs', true]])).toThrow();
    expect(() => commandArguments('ls-remote', [['--help-all'], { operand: '\0' }])).toThrow('NUL');
  });
});
