import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import {
  commandExecutableShapeArguments,
  commandHasLegacyStashHelp,
  commandShapeArguments,
} from '../commands/build.js';
import type { GitCommandName } from '../commands/types.js';
import { GitArgumentError } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

const refusal = 'Use an explicit ["--"] separator before an operand starting with a dash';
/** An inconclusive native observation: neither usage nor a recognized diagnostic. */
const inconclusive = { exitCode: 128, stdout: '', stderr: 'localized output\n', aborted: false };

/** Spawn stub that records every argv and answers each observation inconclusively. */
function adapters() {
  const runtime = createNodeAdapters();
  const spawned: string[][] = [];
  runtime.exec.spawn = vi.fn(({ argv }: { argv: string[] }) => {
    spawned.push(argv);
    return Promise.resolve(inconclusive);
  }) as typeof runtime.exec.spawn;
  return { runtime, spawned };
}

/** Run one command and require the refusal before the user command reaches a process. */
async function expectRefused(
  command: GitCommandName,
  args: readonly unknown[],
  forbidden: string,
  setup?: (runtime: ReturnType<typeof createNodeAdapters>) => void,
): Promise<string[][]> {
  const { runtime, spawned } = adapters();
  setup?.(runtime);
  const run = new CliRunner(runtime).runCommand({ type: 'global' }, command, args as never, true);
  await expect(run).rejects.toBeInstanceOf(GitArgumentError);
  await expect(run).rejects.toThrow(refusal);
  for (const argv of spawned) {
    expect(argv, JSON.stringify(argv)).not.toContain(forbidden);
  }
  return spawned;
}

describe('shape-mode fallbacks refuse dash operand objects', () => {
  it('refuses on an inconclusive depth atoi observation', async () => {
    const spawned = await expectRefused(
      'fetch',
      [['--depth', '2147483648'], { operand: '--upload-pack=touch pwned' }],
      '--upload-pack=touch pwned',
      (runtime) => {
        runtime.fs.writeFile = undefined;
      },
    );
    expect(spawned).toEqual([]);
  });

  it('refuses on an inconclusive empty pickaxe observation', async () => {
    const spawned = await expectRefused(
      'log',
      [['-S', ''], { operand: '--output=pwned' }],
      '--output=pwned',
    );
    expect(spawned).toHaveLength(1);
  });

  it('refuses on an inconclusive submodule init alias observation', async () => {
    await expectRefused(
      'submodule update',
      [['-i'], { operand: '--reference=pwned' }],
      '--reference=pwned',
    );
  });

  it('refuses on an inconclusive ls-tree observation before any probe', async () => {
    const spawned = await expectRefused(
      'ls-tree',
      [['--long'], ['--name-only'], { operand: '--format=pwned' }],
      '--format=pwned',
    );
    expect(spawned).toEqual([]);
  });

  it('refuses on an inconclusive filename profile observation', async () => {
    await expectRefused(
      'tag',
      [['--list'], ['--file', 'message'], ['--no-file'], { operand: '--contains=pwned' }],
      '--contains=pwned',
    );
  });

  it('refuses operand objects that would act as boundaries', async () => {
    await expectRefused('fetch', [['--depth', '2147483648'], { operand: '--' }], '--', (r) => {
      r.fs.writeFile = undefined;
    });
    await expectRefused(
      'log',
      [['-S', ''], { operand: '--end-of-options' }, { operand: 'HEAD' }],
      '--end-of-options',
    );
  });

  it('refuses a legacy stash help word that the selected child could consume as a value', async () => {
    const args = [{ operand: '--message' }, ['-h']];
    expect(commandHasLegacyStashHelp('stash push', args, true)).toBe(true);
    const spawned = await expectRefused('stash push', args, '--message');
    expect(spawned).toEqual([]);
    expect(() =>
      commandExecutableShapeArguments('stash push', [{ operand: '--' }, ['-h']]),
    ).toThrow(refusal);
  });

  it('keeps honored separators, option tuples and proven exits executable', async () => {
    const { runtime, spawned } = adapters();
    runtime.fs.writeFile = undefined;
    await new CliRunner(runtime).runCommand(
      { type: 'global' },
      'fetch',
      [['--depth', '2147483648'], ['--upload-pack', 'git-upload-pack'], ['--'], { operand: '-x' }],
      true,
    );
    expect(spawned).toEqual([
      ['git', 'fetch', '--depth=2147483648', '--upload-pack=git-upload-pack', '--', '-x'],
    ]);
    for (const [command, args] of [
      ['stash export', [{ operand: '--no-print' }, ['-h']]],
      ['stash apply', [{ operand: '--unknown' }, ['-h']]],
      ['log', [['-S', ''], ['--'], { operand: '-p' }]],
      ['fetch', [{ operand: '-h' }]],
    ] as const) {
      expect(commandExecutableShapeArguments(command, args, true)).toEqual(
        commandShapeArguments(command, args, true),
      );
    }
  });

  it('checks both first-pass --empty arities', () => {
    for (const command of ['cherry-pick', 'revert'] as const) {
      expect(() =>
        commandExecutableShapeArguments(command, [{ operand: '--no-walk' }, { operand: 'HEAD' }]),
      ).toThrow(refusal);
      expect(() =>
        commandExecutableShapeArguments(command, [['--'], { operand: '--no-walk' }]),
      ).toThrow(refusal);
    }
  });
});
