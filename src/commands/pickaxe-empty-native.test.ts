import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';

it('matches selected native rejection or acceptance of overwritten empty pickaxe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'type-git-pickaxe-empty-'));
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
    ),
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_GLOBAL: join(root, 'no-config'),
    GIT_CONFIG_NOSYSTEM: '1',
    LC_ALL: 'C',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.test',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.test',
  };
  try {
    const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'file'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'fixture' });
    for (const command of ['diff', 'log', 'difftool'] as const) {
      for (const flag of ['-S', '-G'] as const) {
        const tails = command === 'log' ? ['--oneline', 'HEAD'] : ['HEAD', 'HEAD'];
        const native = spawnSync(
          'git',
          ['-C', repo.workdir, command, flag, '', `${flag}one`, ...tails],
          { env, encoding: 'utf8', timeout: 10000 },
        );
        expect(native.error).toBeUndefined();
        expect(native.signal).toBeNull();
        const args = [
          [flag, ''],
          [flag, 'one'],
          ...(command === 'log' ? [['--oneline']] : []),
          ...tails.filter((word) => word !== '--oneline').map((operand) => ({ operand })),
        ];
        if (native.status === 0) {
          expect((await repo.command(command, args as never)).exitCode).toBe(0);
        } else {
          expect(native.status).toBe(129);
          expect(native.stderr).toContain('requires a non-empty argument');
          await expect(repo.command(command, args as never)).rejects.toBeInstanceOf(
            GitArgumentError,
          );
        }
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
