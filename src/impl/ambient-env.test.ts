/**
 * Programs named in the parent environment do not reach Git by default.
 *
 * Each case sets a variable that would make Git run a command, then runs a Git operation that
 * reads it. A marker file proves whether the command ran.
 */

import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeAdapters } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { createGit } from './git-impl.js';

const USE_LEGACY_VERSION: boolean = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
const NAMES = ['GIT_SSH', 'GIT_SSH_COMMAND', 'GIT_EXTERNAL_DIFF'] as const;

describe('ambient environment variables that name programs', () => {
  let tempDir: string;
  let marker: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'type-git-ambient-env-'));
    marker = join(tempDir, 'pwned');
    for (const name of NAMES) {
      saved[name] = process.env[name];
    }
  });

  afterEach(async () => {
    for (const name of NAMES) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  async function sshScript(): Promise<string> {
    const script = join(tempDir, 'fake-ssh.sh');
    await writeFile(script, `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, { mode: 0o755 });
    return script;
  }

  it.skipIf(process.platform === 'win32')(
    'does not run GIT_SSH_COMMAND or GIT_SSH from the parent environment',
    async () => {
      const script = await sshScript();
      process.env.GIT_SSH_COMMAND = script;
      process.env.GIT_SSH = script;
      const git = await createGit({
        adapters: createNodeAdapters(),
        useLegacyVersion: USE_LEGACY_VERSION,
      });
      await expect(git.lsRemote('ssh://git@127.0.0.1:1/none.git')).rejects.toThrow();
      expect(existsSync(marker)).toBe(false);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'runs GIT_SSH_COMMAND when the caller opts in through inheritEnv',
    async () => {
      process.env.GIT_SSH_COMMAND = await sshScript();
      const git = await createGit({
        adapters: createNodeAdapters(),
        useLegacyVersion: USE_LEGACY_VERSION,
        inheritEnv: ['GIT_SSH_COMMAND'],
      });
      await expect(git.lsRemote('ssh://git@127.0.0.1:1/none.git')).rejects.toThrow();
      expect(existsSync(marker)).toBe(true);
    },
  );

  it('does not run GIT_EXTERNAL_DIFF from the parent environment', async () => {
    process.env.GIT_EXTERNAL_DIFF = `node -e "require('fs').writeFileSync(process.argv[1], '')" ${JSON.stringify(marker)}`;
    const git = await createGit({
      adapters: createNodeAdapters(),
      useLegacyVersion: USE_LEGACY_VERSION,
    });
    const workdir = join(tempDir, 'work');
    const repo = (await git.init(workdir)) as WorktreeRepo;
    await writeFile(join(workdir, 'file.txt'), 'a\n');
    await repo.raw(['add', '-N', 'file.txt']);
    await repo.raw(['diff']);
    expect(existsSync(marker)).toBe(false);
  });
});
