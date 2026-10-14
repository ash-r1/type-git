import { afterEach, describe, expect, it, vi } from 'vitest';
import * as syntax from '../commands/gui-syntax.js';
import type { RuntimeAdapters } from '../core/adapters.js';
import { CliRunner } from './cli-runner.js';

function adapters(): RuntimeAdapters {
  return {
    exec: {
      getCapabilities: () => ({
        canSpawnProcess: true,
        canReadEnv: true,
        canWriteTemp: true,
        supportsAbortSignal: true,
        supportsKillSignal: true,
        runtime: 'node',
      }),
      spawn: vi.fn(async ({ argv }) => ({
        stdout: argv.includes('--exec-path')
          ? '/selected\n'
          : argv.includes('--version')
            ? 'git-gui version fixture\n'
            : 'executed',
        stderr: '',
        exitCode: 0,
        aborted: false,
      })),
    },
    fs: {
      createTempFile: async () => '',
      deleteFile: async () => undefined,
      deleteDirectory: async () => undefined,
      tail: async () => undefined,
      exists: async () => false,
      readFile: vi.fn(async () => "echo 'git-gui version fixture'\n"),
    },
  };
}

describe('selected GUI frontend', () => {
  afterEach(() => vi.restoreAllMocks());
  const args = [['--'], { operand: 'HEAD' }, { operand: 'path' }];
  it('retains the filesystem through withOptions and enforces the identified modern grammar', async () => {
    vi.spyOn(syntax, 'guiGrammarFromSource').mockReturnValue('positional');
    const runtime = adapters();
    const runner = new CliRunner(runtime).withOptions({ env: { MARKER: 'base' } });
    await expect(
      runner.runCommand({ type: 'global' }, 'gui browser', args, undefined, {
        env: { CALL: 'value' },
      }),
    ).rejects.toThrow('argument syntax');
    expect(runtime.fs.readFile).toHaveBeenCalledWith('/selected/git-gui');
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(2);
    for (const [options] of vi.mocked(runtime.exec.spawn).mock.calls) {
      expect(options.env).toMatchObject({ MARKER: 'base', CALL: 'value' });
    }
  });

  it('passes the observed legacy words unchanged when that parser is identified', async () => {
    vi.spyOn(syntax, 'guiGrammarFromSource').mockReturnValue('path-loop');
    const runtime = adapters();
    const result = await new CliRunner(runtime).runCommand(
      { type: 'global' },
      'gui browser',
      args,
      undefined,
    );
    expect(result.stdout).toBe('executed');
    expect(vi.mocked(runtime.exec.spawn).mock.calls.at(-1)?.[0].argv).toEqual([
      'git',
      'gui',
      'browser',
      '--',
      'HEAD',
      'path',
    ]);
  });

  it('defers unknown source and does not infer GUI grammar from a Git version', async () => {
    vi.spyOn(syntax, 'guiGrammarFromSource').mockReturnValue(undefined);
    const runtime = adapters();
    await new CliRunner(runtime).runCommand({ type: 'global' }, 'gui browser', args, undefined);
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(2);
  });

  it('defers inaccessible source without replacing it with a modern profile', async () => {
    const runtime = adapters();
    runtime.fs.readFile = vi.fn(async () => {
      throw new Error('unreadable source');
    });
    await new CliRunner(runtime).runCommand({ type: 'global' }, 'gui browser', args, undefined);
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(2);
  });

  it('does not activate a source profile when a different frontend reports the version', async () => {
    vi.spyOn(syntax, 'guiGrammarFromSource').mockReturnValue('positional');
    const runtime = adapters();
    runtime.exec.spawn = vi.fn(async ({ argv }) => ({
      stdout: argv.includes('--exec-path')
        ? '/selected\n'
        : argv.includes('--version')
          ? 'different frontend\n'
          : 'executed',
      stderr: '',
      exitCode: 0,
      aborted: false,
    }));
    const result = await new CliRunner(runtime).runCommand(
      { type: 'global' },
      'gui browser',
      args,
      undefined,
    );
    expect(result.stdout).toBe('executed');
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(3);
  });

  it('does not launch a modal version probe for a verified direct-Tcl wrapper', async () => {
    vi.spyOn(syntax, 'guiLaunchFromSource').mockReturnValue('direct-tcl');
    const runtime = adapters();
    await expect(
      new CliRunner(runtime).runCommand({ type: 'global' }, 'gui', [['--version']], undefined),
    ).rejects.toThrow('argument syntax');
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runtime.exec.spawn).mock.calls[0]?.[0].argv).toEqual(['git', '--exec-path']);
  });

  it('rejects Windows working-directory words for an identified shell frontend', async () => {
    vi.spyOn(syntax, 'guiLaunchFromSource').mockReturnValue('shell-prelude');
    vi.spyOn(syntax, 'guiGrammarFromSource').mockReturnValue('positional');
    const runtime = adapters();
    await expect(
      new CliRunner(runtime).runCommand(
        { type: 'global' },
        'gui',
        [{ operand: '--working-dir' }, { operand: '/repository' }],
        undefined,
      ),
    ).rejects.toThrow('argument syntax');
    expect(runtime.exec.spawn).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed IO before any source lookup or process probe', async () => {
    const runtime = adapters();
    await expect(
      new CliRunner(runtime).runCommand({ type: 'global' }, 'gui browser', args, undefined, {
        stdout: 'invalid' as 'text',
      }),
    ).rejects.toThrow();
    expect(runtime.exec.spawn).not.toHaveBeenCalled();
    expect(runtime.fs.readFile).not.toHaveBeenCalled();
  });
});
