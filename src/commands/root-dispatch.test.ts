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

const commandList = spawnSync('git', ['--list-cmds=main'], { encoding: 'utf8' });
if (commandList.error || commandList.signal || commandList.status !== 0) {
  throw new Error(`Cannot inspect selected Git commands: ${commandList.stderr}`);
}
const nativeCommands = new Set(commandList.stdout.trim().split(/\s+/));
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
      LC_ALL: 'C',
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

  for (const command of [
    'bundle',
    'commit-graph',
    'history',
    'hook',
    'maintenance',
    'multi-pack-index',
    'refs',
    'repo',
  ] as const) {
    it.skipIf(!nativeCommands.has(command))(
      `requires a registered operation for ${command}`,
      () => {
        compare(command, [], [], false);
        compare(command, [{ operand: 'unknown' }], ['unknown'], false);
      },
    );
  }
  const nativeVersion = spawnSync('git', ['version'], { encoding: 'utf8' });
  const version = /git version (\d+)\.(\d+)/.exec(nativeVersion.stdout);
  if (nativeVersion.status !== 0 || !version)
    throw new Error('Cannot inspect selected Git version');
  // These rejection cases were verified with the native subcommand parser in Git 2.47 and 2.55.
  // Git 2.25 uses manual dispatch and can accept a separator before the operation.
  const nativeSubcommandParser = Number(version[1]) > 2 || Number(version[2]) >= 47;
  for (const [command, operation] of [
    ['bundle', 'verify'],
    ['commit-graph', 'verify'],
    ['history', 'reword'],
    ['hook', 'run'],
    ['maintenance', 'run'],
    ['multi-pack-index', 'verify'],
    ['refs', 'verify'],
    ['repo', 'info'],
  ] as const) {
    it.skipIf(!nativeSubcommandParser || !nativeCommands.has(command))(
      `rejects a separator before the ${command} operation`,
      () => {
        compare(command, [['--'], { operand: operation }], ['--', operation], false);
        expect(direct([command, '--', operation]).stderr).toContain('need a subcommand');
      },
    );
  }
  it('forwards operation arguments and accepts common options before dispatch', () => {
    const bundle = join(root, 'test.bundle');
    expect(direct(['bundle', 'create', bundle, 'HEAD']).status).toBe(0);
    compare(
      'bundle',
      [{ operand: 'verify' }, { operand: '--quiet' }, { operand: bundle }],
      ['verify', '--quiet', bundle],
      true,
    );
    compare(
      'bundle',
      [{ operand: 'verify' }, { operand: '--' }, { operand: bundle }],
      ['verify', '--', bundle],
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
  const modernTargets = [
    ['hook', ['run', '--ignore-missing', 'pre-commit']],
    ['maintenance', ['run', '--task=commit-graph']],
    ['refs', ['verify']],
    ['repo', ['info', '--format=lines']],
    ['history', ['reword', '--dry-run', 'HEAD']],
  ] as const;
  for (const [command, words] of modernTargets) {
    it.skipIf(!nativeCommands.has(command))(
      `executes ${command} dispatch in an isolated repository`,
      () => {
        compare(
          command,
          words.map((operand) => ({ operand })),
          [...words],
          true,
        );
      },
    );
  }
});
