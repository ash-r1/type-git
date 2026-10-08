import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

describe('synthesized LFS completion helpers', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-lfs-completion-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      LC_ALL: 'C',
    };
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  it('requires one fragment but accepts an empty fragment for both registered names', () => {
    for (const command of ['lfs __complete', 'lfs __completeNoDesc'] as const) {
      const empty = spawnSync('git', command.split(' '), { cwd: root, env, encoding: 'utf8' });
      expect(empty.status).not.toBe(0);
      expect(empty.stderr).toContain('requires at least 1 arg');
      expect(() => commandArguments(command, [])).toThrow(GitArgumentError);
      const args = commandArguments(command, [{ operand: '' }]);
      const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('checkout');
      expect(result.stdout).toMatch(/:\d+\n$/);
    }
  });
  it('preserves flag-like words and protocol errors as literal completion inputs', () => {
    for (const command of ['lfs __complete', 'lfs __completeNoDesc'] as const) {
      for (const words of [
        ['--help'],
        ['--'],
        ['fetch', '--recent', ''],
        ['unknown-command', ''],
      ]) {
        const args = commandArguments(
          command,
          words.map((operand) => ({ operand })),
        );
        expect(args).toEqual([...command.split(' '), ...words]);
        const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toMatch(/:\d+\n$/);
      }
      expect(() => commandArguments(command, [['--help']])).toThrow(GitArgumentError);
      expect(() => commandArguments(command, [['--'], { operand: '' }])).toThrow(GitArgumentError);
    }
  });
});
