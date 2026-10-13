import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('required native root dispatch', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-root-dispatch-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_EDITOR: 'true',
      GIT_ALLOW_PROTOCOL: 'file',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await writeFile(join(repo.workdir, 'second'), 'two\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
    await repo.add('.');
    await repo.commit({ message: 'second' });
    for (let i = 0; i < 4; i++) {
      expect(direct(['commit', '--allow-empty', '-m', `step ${i}`]).status).toBe(0);
    }
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
    input = '',
  ) => {
    const actual = direct([...command.split(' '), ...argv], input);
    const label = `${command} ${argv.join(' ')}: ${actual.stderr}`;
    expect(actual.signal, label).toBe(null);
    expect(actual.error, label).toBeUndefined();
    expect(actual.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([...command.split(' '), ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };

  it('requires a registered operation at each root', () => {
    const commands = legacy
      ? ['bundle', 'commit-graph', 'multi-pack-index']
      : [
          'bundle',
          'commit-graph',
          'history',
          'hook',
          'maintenance',
          'multi-pack-index',
          'refs',
          'repo',
        ];
    for (const command of commands) {
      compare(command as GitCommandName, [], [], false);
      compare(command as GitCommandName, [{ operand: 'unknown' }], ['unknown'], false);
    }
  });
  it('forwards operation arguments and accepts common options before dispatch', () => {
    const bundle = join(root, 'test.bundle');
    expect(direct(['bundle', 'create', bundle, 'HEAD']).status).toBe(0);
    compare(
      'bundle',
      [{ operand: 'verify' }, { operand: '--quiet' }, { operand: bundle }],
      ['verify', '--quiet', bundle],
      true,
    );
    for (const command of ['commit-graph', 'multi-pack-index'] as const) {
      const objects = join(repo.workdir, '.git', 'objects');
      compare(
        command,
        [['--object-dir', objects], { operand: 'verify' }],
        [`--object-dir=${objects}`, 'verify'],
        true,
      );
    }
  });
  it.skipIf(legacy)('executes modern dispatch targets in an isolated repository', () => {
    compare(
      'hook',
      [{ operand: 'run' }, { operand: '--ignore-missing' }, { operand: 'pre-commit' }],
      ['run', '--ignore-missing', 'pre-commit'],
      true,
    );
    compare(
      'maintenance',
      [{ operand: 'run' }, { operand: '--task=commit-graph' }],
      ['run', '--task=commit-graph'],
      true,
    );
    compare('refs', [{ operand: 'verify' }], ['verify'], true);
    compare(
      'repo',
      [{ operand: 'info' }, { operand: '--format=lines' }],
      ['info', '--format=lines'],
      true,
    );
    compare(
      'history',
      [{ operand: 'reword' }, { operand: '--dry-run' }, { operand: 'HEAD' }],
      ['reword', '--dry-run', 'HEAD'],
      true,
    );
  });
});
