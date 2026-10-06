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
const fsmonitorAvailable =
  !spawnSync('git', ['fsmonitor--daemon', '-h'], { encoding: 'utf8' }).stderr.includes(
    'not supported',
  ) &&
  spawnSync('git', ['fsmonitor--daemon', '-h'], { encoding: 'utf8' }).stderr.includes(
    'ipc-threads',
  );
describe('help and daemon entrypoint grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-help-daemon-'));
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

  it('preserves listing command modes and last-wins manual format selection', () => {
    compare('help', [], [], true);
    compare('help', [['--guides']], ['--guides'], true);
    if (!legacy) {
      compare('help', [['--guides'], ['--all']], ['--guides', '--all'], false);
      compare('help', [['--guides'], { operand: 'git' }], ['--guides', 'git'], false);
      compare('help', [['--guides'], ['--man']], ['--guides', '--man'], false);
      compare(
        'help',
        [['--guides'], ['--man'], ['--no-man']],
        ['--guides', '--man', '--no-man'],
        true,
      );
    }
    if (!legacy) {
      compare('help', [['--no-aliases']], ['--no-aliases'], false);
      compare('help', [['--no-external-commands']], ['--no-external-commands'], false);
      compare(
        'help',
        [['--all'], ['--no-aliases'], ['--no-external-commands']],
        ['--all', '--no-aliases', '--no-external-commands'],
        true,
      );
    }
  });
  it('rejects daemon mode conflicts before accepting service input', () => {
    for (const flag of ['--detach', '--user', '--group', '--listen']) {
      const value = flag === '--detach' ? [] : [''];
      const argv = flag === '--detach' ? flag : `${flag}=`;
      compare('daemon', [['--inetd'], [flag, ...value]], ['--inetd', argv], false);
    }
    compare('daemon', [['--group', '']], ['--group='], false);
    compare('daemon', [['--strict-paths']], ['--strict-paths'], false);
    compare(
      'daemon',
      [['--serve'], ['--enable', 'unknown']],
      ['--serve', '--enable=unknown'],
      false,
    );
    compare(
      'daemon',
      [['--serve'], ['--log-destination', 'STDERR']],
      ['--serve', '--log-destination=STDERR'],
      false,
    );
    if (!legacy) {
      compare(
        'daemon',
        [['--serve'], ['--timeout', -1], ['--timeout', 1]],
        ['--serve', '--timeout=-1', '--timeout=1'],
        false,
      );
    }
  });
  it('serves a single local read-only request over stdin without opening a listener', () => {
    const directory = join(repo.workdir, '.git');
    const request = `git-upload-pack ${directory}\0host=localhost\0`;
    const packet = `${(Buffer.byteLength(request) + 4).toString(16).padStart(4, '0')}${request}0000`;
    compare(
      'daemon',
      [['--serve'], ['--export-all'], ['--log-destination', 'stderr']],
      ['--serve', '--export-all', '--log-destination=stderr'],
      true,
      packet,
    );
    compare(
      'daemon',
      [
        ['--serve'],
        ['--export-all'],
        ['--strict-paths'],
        ['--max-connections', -1],
        { operand: directory },
      ],
      ['--serve', '--export-all', '--strict-paths', '--max-connections=-1', directory],
      true,
      packet,
    );
    compare(
      'daemon',
      [['--serve'], ['--export-all'], ['--base-path-relaxed']],
      ['--serve', '--export-all', '--base-path-relaxed'],
      true,
      packet,
    );
  });
  it('validates the supported-platform fsmonitor grammar without claiming native platform support', () => {
    expect(() => commandArguments('fsmonitor--daemon', [], true)).toThrow(GitArgumentError);
    expect(() => commandArguments('fsmonitor--daemon', [{ operand: 'unknown' }], true)).toThrow(
      GitArgumentError,
    );
    for (const op of ['start', 'run', 'stop', 'status'] as const) {
      const cmd = `fsmonitor--daemon ${op}` as const;
      expect(commandArguments(cmd, [['--ipc-threads', 2]], true)).toEqual([
        'fsmonitor--daemon',
        op,
        '--ipc-threads=2',
      ]);
      expect(() => commandArguments(cmd, [['--ipc-threads', 0]], true)).toThrow(GitArgumentError);
      expect(() => commandArguments(cmd, [{ operand: 'extra' }], true)).toThrow(GitArgumentError);
    }
  });
  it.skipIf(!fsmonitorAvailable)(
    'compares fsmonitor parser failures on a supported platform',
    () => {
      compare('fsmonitor--daemon', [], [], false);
      compare('fsmonitor--daemon status', [['--ipc-threads', 0]], ['--ipc-threads=0'], false);
    },
  );
});
