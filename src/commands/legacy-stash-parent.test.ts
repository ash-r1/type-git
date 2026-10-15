import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { commandHasLegacyStashHelp } from './build.js';
import type { GitCommandName } from './types.js';

describe('source-dependent stash parent help', () => {
  it('preserves the selected native result before child callback and arity checks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-stash-parent-help-'));
    try {
      const env = {
        PATH: process.env.PATH ?? '',
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_COUNT: '0',
        LC_ALL: 'C',
      };
      const git = new TypeGit({ inheritEnv: false, env });
      const repo = await git.init(join(root, 'repo'));
      const cases = [
        { command: 'stash', args: [{ operand: '-push' }, ['-h']], words: ['-push', '-h'] },
        { command: 'stash', args: [{ operand: 'file' }, ['-h']], words: ['file', '-h'] },
        {
          command: 'stash clear',
          args: [{ operand: 'file' }, ['-h']],
          words: ['clear', 'file', '-h'],
        },
        {
          command: 'stash push',
          args: [['--unified', 'bad'], ['-h']],
          words: ['push', '--unified=bad', '-h'],
        },
        {
          command: 'stash save',
          args: [['--inter-hunk-context', 'bad'], ['-h']],
          words: ['save', '--inter-hunk-context=bad', '-h'],
        },
        {
          command: 'stash apply',
          args: [{ operand: '--unknown' }, ['-h']],
          words: ['apply', '--unknown', '-h'],
        },
      ];
      for (const row of cases) {
        const native = spawnSync('git', ['stash', ...row.words], {
          cwd: join(root, 'repo'),
          env,
          input: '',
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(native.error, JSON.stringify(row.words)).toBeUndefined();
        expect(native.signal).toBeNull();
        const actual = await repo.command(row.command as GitCommandName, row.args as never);
        expect(actual.exitCode, JSON.stringify(row.words)).toBe(native.status);
        expect(actual.stdout).toBe(native.stdout);
        expect(actual.stderr).toBe(native.stderr);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('does not treat literal or unparsed clustered h as a parent help exit', () => {
    expect(commandHasLegacyStashHelp('stash clear', [['--'], ['-h']])).toBe(false);
    expect(commandHasLegacyStashHelp('stash apply', [{ operand: '-xh' }])).toBe(false);
    expect(commandHasLegacyStashHelp('stash apply', [{ operand: '--message=-h' }])).toBe(false);
    expect(commandHasLegacyStashHelp('stash clear', [{ operand: 'file' }, ['-h']])).toBe(true);
  });
});
