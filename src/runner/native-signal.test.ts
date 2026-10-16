import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { AuditEvent } from '../core/types.js';
import { CliRunner } from './cli-runner.js';

it('retains adapter termination evidence in raw results, mapped errors and audit events', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi.fn().mockResolvedValue({
    exitCode: -1,
    stdout: 'partial',
    stderr: 'native abort',
    signal: 'SIGABRT',
    aborted: false,
  });
  const events: AuditEvent[] = [];
  const runner = new CliRunner(adapters, { audit: { onAudit: (event) => events.push(event) } });
  const result = await runner.run({ type: 'global' }, ['version']);
  expect(result).toEqual({
    exitCode: -1,
    stdout: 'partial',
    stderr: 'native abort',
    signal: 'SIGABRT',
    aborted: false,
  });
  expect(runner.mapError(result, { type: 'global' }, ['git', 'version'])).toEqual(
    expect.objectContaining({
      kind: 'NonZeroExit',
      context: expect.objectContaining({ signal: 'SIGABRT', exitCode: -1 }),
    }),
  );
  expect(events.at(-1)).toEqual(
    expect.objectContaining({ type: 'end', signal: 'SIGABRT', aborted: false }),
  );
});
it('keeps cancellation distinct from a native nonzero signal result', () => {
  const runner = new CliRunner(createNodeAdapters());
  const error = runner.mapError(
    { exitCode: -1, stdout: '', stderr: '', signal: 'SIGTERM', aborted: true },
    { type: 'global' },
    ['git'],
  );
  expect(error?.kind).toBe('Aborted');
  expect(error?.context.signal).toBe('SIGTERM');
});
it('does not invent a signal when the adapter does not provide one', async () => {
  const adapters = createNodeAdapters();
  adapters.exec.spawn = vi
    .fn()
    .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', aborted: false });
  const result = await new CliRunner(adapters).run({ type: 'global' }, ['version']);
  expect(Object.hasOwn(result, 'signal')).toBe(false);
});
it('retains native signals and exact bytes in binary stdout results and audit', async () => {
  const adapters = createNodeAdapters();
  const bytes = new Uint8Array([0, 255, 10]);
  adapters.exec.spawnBytes = vi.fn().mockResolvedValue({
    exitCode: -1,
    stdout: bytes,
    stderr: 'native abort',
    signal: 'SIGABRT',
    aborted: false,
  });
  const events: AuditEvent[] = [];
  const runner = new CliRunner(adapters, { audit: { onAudit: (event) => events.push(event) } });
  const result = await runner.runBytes({ type: 'global' }, ['version']);
  expect(result.signal).toBe('SIGABRT');
  expect(result.stdout).toEqual(bytes);
  expect(events.at(-1)).toEqual(
    expect.objectContaining({ signal: 'SIGABRT', stdoutBytes: bytes, stdout: '' }),
  );
});
it('retains the existing spawn-failure category when there is no process signal', () => {
  const runner = new CliRunner(createNodeAdapters());
  expect(
    runner.mapError(
      { exitCode: -1, stdout: '', stderr: 'spawn failed', aborted: false },
      { type: 'global' },
      ['git'],
    )?.kind,
  ).toBe('SpawnFailed');
});
it.skipIf(process.platform === 'win32')(
  'retains actual process signal termination independently of AbortSignal',
  async () => {
    const runner = new CliRunner(createNodeAdapters(), { gitBinary: process.execPath });
    const result = await runner.run({ type: 'global' }, [
      '-e',
      "process.stderr.write('native termination\\n'); process.kill(process.pid, 'SIGTERM')",
    ]);
    expect(result.signal).toBe('SIGTERM');
    expect(result.exitCode).toBe(-1);
    expect(result.aborted).toBe(false);
    expect(result.stderr).toBe('native termination\n');
    expect(runner.mapError(result, { type: 'global' }, [process.execPath])?.kind).toBe(
      'NonZeroExit',
    );
  },
);

const crashGit = process.env.TYPE_GIT_SIGNAL_CRASH_BINARY;
it.skipIf(!crashGit || process.platform === 'win32')(
  'retains an observed native Git crash through the real adapter',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-signal-git-'));
    const repo = join(root, 'repo');
    const env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'no-config'),
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.test',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.test',
    };
    try {
      expect(spawnSync(crashGit!, ['init', '-q', repo], { env }).status).toBe(0);
      await writeFile(join(repo, 'file'), 'one\n');
      expect(spawnSync(crashGit!, ['-C', repo, 'add', 'file'], { env }).status).toBe(0);
      expect(spawnSync(crashGit!, ['-C', repo, 'commit', '-qm', 'fixture'], { env }).status).toBe(
        0,
      );
      const args = ['diff', '-S', '', 'HEAD', 'HEAD'];
      const native = spawnSync(crashGit!, ['-C', repo, ...args], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(native.error).toBeUndefined();
      expect(native.signal).toBe('SIGABRT');
      const runner = new CliRunner(createNodeAdapters(), {
        gitBinary: crashGit,
        env,
        inheritEnv: false,
      });
      const result = await runner.run({ type: 'worktree', workdir: repo }, args);
      expect(result.signal).toBe(native.signal);
      expect(result.exitCode).toBe(-1);
      expect(result.aborted).toBe(false);
      expect(runner.mapError(result, { type: 'worktree', workdir: repo }, args)?.kind).toBe(
        'NonZeroExit',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
