/**
 * NodeExecAdapter constructor options forwarded to child_process.spawn
 */

import * as childProcess from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeExecAdapter } from './exec.js';
import { createNodeAdapters, TypeGit } from './index.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

const spawnMock: ReturnType<typeof vi.mocked<typeof childProcess.spawn>> = vi.mocked(
  childProcess.spawn,
);
const argv: string[] = [process.execPath, '-e', ''];

function lastSpawnOptions(): childProcess.SpawnOptions {
  const call = spawnMock.mock.calls.at(-1);
  if (!call) {
    throw new Error('spawn was not called');
  }
  return call[2] as childProcess.SpawnOptions;
}

describe('NodeExecAdapter options', () => {
  afterEach(() => {
    spawnMock.mockClear();
  });

  it('leaves windowsHide unset by default', async () => {
    await new NodeExecAdapter().spawn({ argv });
    expect(lastSpawnOptions()).not.toHaveProperty('windowsHide');
  });

  it.each([true, false])('forwards windowsHide=%s from spawn', async (windowsHide) => {
    const adapter = new NodeExecAdapter({ windowsHide });
    await adapter.spawn({ argv });
    expect(lastSpawnOptions().windowsHide).toBe(windowsHide);
    await adapter.spawnBytes({ argv });
    expect(lastSpawnOptions().windowsHide).toBe(windowsHide);
    await adapter.spawnStreaming({ argv }).wait();
    expect(lastSpawnOptions().windowsHide).toBe(windowsHide);
  });

  it('forwards windowsHide through createNodeAdapters', async () => {
    await createNodeAdapters({ windowsHide: true }).exec.spawn({ argv });
    expect(lastSpawnOptions().windowsHide).toBe(true);
  });

  it('forwards windowsHide through TypeGit.create', async () => {
    const git = await TypeGit.create({ windowsHide: true, skipVersionCheck: true });
    spawnMock.mockClear();
    await git.raw(['--version']);
    expect(spawnMock).toHaveBeenCalled();
    for (const call of spawnMock.mock.calls) {
      expect((call[2] as childProcess.SpawnOptions).windowsHide).toBe(true);
    }
  });

  it('forwards windowsHide through the deprecated TypeGit constructor', async () => {
    const git = new TypeGit({ windowsHide: true, skipVersionCheck: true });
    spawnMock.mockClear();
    await git.raw(['--version']);
    expect(spawnMock).toHaveBeenCalled();
    for (const call of spawnMock.mock.calls) {
      expect((call[2] as childProcess.SpawnOptions).windowsHide).toBe(true);
    }
  });

  it('rejects a non-boolean windowsHide', () => {
    expect(() => new NodeExecAdapter({ windowsHide: 'yes' as unknown as boolean })).toThrow(
      TypeError,
    );
  });

  it('does not expose arbitrary spawn options', async () => {
    // @ts-expect-error shell would let Git arguments be reinterpreted by a shell
    const adapter = new NodeExecAdapter({ shell: true });
    await adapter.spawn({ argv });
    expect(lastSpawnOptions()).not.toHaveProperty('shell');
  });
});
