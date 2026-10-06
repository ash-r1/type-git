import { describe, expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { AuditEvent } from '../core/types.js';
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
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_0: 'test.existing',
          GIT_CONFIG_KEY_1: 'credential.helper',
          GIT_CONFIG_VALUE_1: 'fixture',
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
});
