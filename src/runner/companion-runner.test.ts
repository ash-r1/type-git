import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { AuditEvent } from '../core/types.js';
import { createGitSync } from '../impl/git-impl.js';
import { CliRunner } from './cli-runner.js';

function fixture() {
  const adapters = createNodeAdapters();
  const spawn = vi
    .spyOn(adapters.exec, 'spawn')
    .mockResolvedValue({ stdout: 'output', stderr: '', exitCode: 0, aborted: false });
  return { adapters, spawn };
}
describe('standalone upstream execution', () => {
  it('preserves binary overrides, repository context, input, environment and audit through withOptions', async () => {
    const { adapters, spawn } = fixture();
    const events: AuditEvent[] = [];
    const runner = new CliRunner(adapters, {
      companionBinaries: { scalar: '/tools/scalar' },
      inheritEnv: false,
      home: '/isolated',
      env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'test.existing', GIT_CONFIG_VALUE_0: 'yes' },
      credential: { helper: 'fixture' },
      audit: { onAudit: (e) => events.push(e) },
    }).withOptions({ env: { EXTRA: 'value' } });
    const signal = new AbortController().signal;
    const context = { type: 'worktree', workdir: '/fixture' } as const;
    await runner.runCompanion(context, 'scalar', ['version'], { stdin: 'input', signal });
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ['/tools/scalar', 'version'],
        cwd: '/fixture',
        stdin: 'input',
        signal,
        inheritEnv: false,
        env: expect.objectContaining({
          HOME: '/isolated',
          EXTRA: 'value',
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'test.existing',
          GIT_CONFIG_PARAMETERS: "'credential.helper=fixture'",
        }),
      }),
      undefined,
    );
    expect(events.map((e) => e.type)).toEqual(['start', 'end']);
    expect(events[0]).toMatchObject({ argv: ['/tools/scalar', 'version'], context });
  });
  it('uses the bare directory without inserting git-only argv and reports spawn failures', async () => {
    const { adapters, spawn } = fixture();
    const runner = new CliRunner(adapters, { inheritEnv: false });
    await runner.runCompanion({ type: 'bare', gitDir: '/bare.git' }, 'gitk', []);
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ argv: ['gitk'], cwd: '/bare.git' }),
      undefined,
    );
    spawn.mockRejectedValueOnce(new Error('missing CGI executable'));
    await expect(runner.runCompanion({ type: 'global' }, 'gitweb', [])).rejects.toMatchObject({
      kind: 'SpawnFailed',
      context: { argv: ['gitweb.cgi'] },
    });
  });
  it('does not spawn an already cancelled companion command', async () => {
    const { adapters, spawn } = fixture();
    const signal = AbortSignal.abort();
    const runner = new CliRunner(adapters);
    expect(
      await runner.runCompanion({ type: 'global' }, 'scalar', ['version'], { signal }),
    ).toMatchObject({ aborted: true, exitCode: -1 });
    expect(spawn).not.toHaveBeenCalled();
  });
  it('keeps default and configured binaries when optional overrides are undefined', async () => {
    const { adapters, spawn } = fixture();
    const context = { type: 'global' } as const;
    const defaults = new CliRunner(adapters, {
      companionBinaries: { scalar: undefined, gitk: undefined, gitweb: undefined },
    });
    for (const executable of ['scalar', 'gitk', 'gitweb'] as const) {
      await defaults.runCompanion(context, executable, []);
      expect(spawn).toHaveBeenLastCalledWith(
        expect.objectContaining({ argv: [executable === 'gitweb' ? 'gitweb.cgi' : executable] }),
        undefined,
      );
    }
    const configured = new CliRunner(adapters, {
      companionBinaries: { scalar: '/tools/scalar', gitk: '/tools/gitk', gitweb: '/tools/gitweb' },
    }).withOptions({
      companionBinaries: { scalar: undefined, gitk: '/alternate/gitk', gitweb: undefined },
    });
    for (const [executable, binary] of [
      ['scalar', '/tools/scalar'],
      ['gitk', '/alternate/gitk'],
      ['gitweb', '/tools/gitweb'],
    ] as const) {
      await configured.runCompanion(context, executable, []);
      expect(spawn).toHaveBeenLastCalledWith(
        expect.objectContaining({ argv: [binary] }),
        undefined,
      );
    }
  });
});

describe('standalone execution against actual process adapters', () => {
  it('preserves native Git configuration parsing and safely quotes credential overrides', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-companion-config-'));
    try {
      const helper = "quotes' and ! slash\\ 日本語\nline";
      for (const count of ['1', '0x1']) {
        const env = {
          PATH: process.env.PATH ?? '',
          HOME: root,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: join(root, 'global'),
          GIT_CONFIG_COUNT: count,
          GIT_CONFIG_KEY_0: 'credential.helper',
          GIT_CONFIG_VALUE_0: 'prior',
          GIT_CONFIG_PARAMETERS: "'test.existing=yes'",
        };
        const expected = spawnSync(
          'git',
          ['-c', `credential.helper=${helper}`, 'config', '--get-all', 'credential.helper'],
          { env, encoding: 'utf8', timeout: 10000 },
        );
        expect(expected.error).toBeUndefined();
        expect(expected.signal).toBeNull();
        const runner = new CliRunner(createNodeAdapters(), {
          // Git itself is the real subprocess used to inspect the forwarded environment.
          companionBinaries: { scalar: 'git' },
          inheritEnv: false,
          env,
          credential: { helper },
        });
        const result = await runner.runCompanion({ type: 'global' }, 'scalar', [
          'config',
          '--get-all',
          'credential.helper',
        ]);
        expect(result.exitCode).toBe(expected.status);
        expect(result.stdout).toBe(expected.stdout);
        expect(result.stderr).toBe(expected.stderr);
        expect(result.aborted).toBe(false);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('retains offset binary input and undecoded companion output', async () => {
    const git = createGitSync({
      adapters: createNodeAdapters(),
      companionBinaries: { gitk: process.execPath },
    });
    const backing = new Uint8Array([99, 0, 255, 128, 13, 10, 99]);
    const input = backing.subarray(1, 6);
    const result = await git.command(
      'gitk',
      [
        { operand: '-e' },
        { operand: "process.stdin.on('data', chunk => process.stdout.write(chunk))" },
      ],
      { stdin: input, stdout: 'bytes' },
    );
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout).toEqual(input);
  });
});
