import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from '../runner/cli-runner.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('argv representation before command interpretation', () => {
  const cases: { command: GitCommandName; args: readonly unknown[] }[] = [
    { command: 'gui', args: [{ operand: 'bad\0subject' }] },
    { command: 'config', args: [{ operand: 'get' }, { operand: 'bad\0key' }] },
    { command: 'config', args: [['--file', 'bad\0file'], { operand: 'get' }, { operand: 'key' }] },
    { command: 'clone', args: [['--filter', 'combine:sparse:oid=é'], { operand: 'bad\0url' }] },
    { command: 'cherry-pick', args: [['--mainline', 2147483648], { operand: 'bad\0commit' }] },
    { command: 'lfs pointer', args: [['--file', 'bad\0file']] },
  ];
  for (const { command, args } of cases) {
    it(`rejects NUL for ${command} before source, ABI, char, or dispatch probes`, async () => {
      const adapters = createNodeAdapters();
      adapters.exec.spawn = vi.fn();
      await expect(
        new CliRunner(adapters).runCommand({ type: 'global' }, command, args, true),
      ).rejects.toBeInstanceOf(GitArgumentError);
      expect(adapters.exec.spawn).not.toHaveBeenCalled();
    });
  }
  it('ignores metadata that is not emitted as an argv word', () => {
    expect(
      commandArguments('log', [['-h'], { operand: 'subject', metadata: 'unused\0value' }], true),
    ).toEqual(['log', '-h', 'subject']);
  });
});
