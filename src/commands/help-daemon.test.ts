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

describe('help and daemon entrypoint grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let native255: boolean;
  let listingConstraints: boolean;
  let fsmonitorAvailable: boolean;
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
      LC_ALL: 'C',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    const version = direct(['version']);
    expect(version.error).toBeUndefined();
    expect(version.signal).toBe(null);
    expect(version.status).toBe(0);
    const match = /git version (\d+)\.(\d+)/.exec(version.stdout);
    expect(match).not.toBe(null);
    native255 = Number(match?.[1]) > 2 || (Number(match?.[1]) === 2 && Number(match?.[2]) >= 55);
    const help = direct(['help', '-h']);
    expect(help.error).toBeUndefined();
    expect(help.signal).toBe(null);
    expect([0, 129]).toContain(help.status);
    const helpText = (help.stdout + help.stderr).replaceAll('--[no-]', '--');
    expect(helpText).toContain('usage:');
    listingConstraints = helpText.includes('--aliases') && helpText.includes('--external-commands');
    const fsHelp = direct(['fsmonitor--daemon', '-h']);
    expect(fsHelp.error).toBeUndefined();
    expect(fsHelp.signal).toBe(null);
    const fsText = fsHelp.stdout + fsHelp.stderr;
    if (fsText.includes('is not a git command')) {
      expect(fsHelp.status).toBe(1);
      fsmonitorAvailable = false;
    } else {
      expect([0, 129]).toContain(fsHelp.status);
      expect(fsText).toContain('usage:');
      fsmonitorAvailable = fsText.includes('ipc-threads');
      if (!fsmonitorAvailable) {
        const unsupported = direct(['fsmonitor--daemon', 'status']);
        expect(unsupported.error).toBeUndefined();
        expect(unsupported.signal).toBe(null);
        expect(unsupported.status).toBe(128);
        expect(unsupported.stderr).toContain('not supported on this platform');
      }
    }
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
    return actual;
  };

  it('preserves universal help listings', () => {
    compare('help', [], [], true);
    compare('help', [['--guides']], ['--guides'], true);
  });
  it('preserves supported listing modes, selectors and last-wins manual formats', (context) => {
    if (!listingConstraints) {
      const oldModes = direct(['help', '--guides', '--all']);
      expect(oldModes.error).toBeUndefined();
      expect(oldModes.signal).toBe(null);
      expect(oldModes.status).toBe(0);
      context.skip();
      return;
    }
    compare('help', [['--guides'], ['--all']], ['--guides', '--all'], false);
    compare('help', [['--guides'], { operand: 'git' }], ['--guides', 'git'], false);
    compare('help', [['--guides'], ['--man']], ['--guides', '--man'], false);
    compare(
      'help',
      [['--guides'], ['--man'], ['--no-man']],
      ['--guides', '--man', '--no-man'],
      true,
    );
    compare('help', [['--no-aliases']], ['--no-aliases'], false);
    compare('help', [['--no-external-commands']], ['--no-external-commands'], false);
    compare(
      'help',
      [['--all'], ['--no-aliases'], ['--no-external-commands']],
      ['--all', '--no-aliases', '--no-external-commands'],
      true,
    );
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
  });
  it('serves a single local read-only request through direct and public byte APIs without a listener', async () => {
    const directory = join(repo.workdir, '.git');
    const request = `git-upload-pack ${directory}\0host=localhost\0`;
    const packet = `${(Buffer.byteLength(request) + 4).toString(16).padStart(4, '0')}${request}0000`;
    const advertised = compare(
      'daemon',
      [['--serve'], ['--export-all'], ['--log-destination', 'stderr']],
      ['--serve', '--export-all', '--log-destination=stderr'],
      true,
      packet,
    );
    const publicResult = await repo.command(
      'daemon',
      [['--serve'], ['--export-all'], ['--log-destination', 'stderr']],
      { stdin: new Uint8Array(Buffer.from(packet)), stdout: 'bytes' },
    );
    expect(publicResult.exitCode, publicResult.stderr).toBe(0);
    expect(publicResult.aborted).toBe(false);
    expect(publicResult.stdout).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(publicResult.stdout)).toEqual(Buffer.from(advertised.stdout));
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
  it('accepts daemon signed and unsigned integer boundaries with local service input', () => {
    const request = `git-upload-pack ${join(repo.workdir, '.git')}\0host=localhost\0`;
    const packet = `${(Buffer.byteLength(request) + 4).toString(16).padStart(4, '0')}${request}0000`;
    for (const [flag, value] of [
      ['--timeout', 4294967295],
      ['--init-timeout', 4294967295],
      ['--max-connections', -2147483648],
      ['--max-connections', 2147483647],
    ] as const) {
      compare(
        'daemon',
        [['--serve'], ['--export-all'], [flag, value], [flag, 1]],
        ['--serve', '--export-all', `${flag}=${value}`, `${flag}=1`],
        true,
        packet,
      );
    }
  });
  it('rejects daemon callback overflow before a later value can replace it', (context) => {
    const request = `git-upload-pack ${join(repo.workdir, '.git')}\0host=localhost\0`;
    const packet = `${(Buffer.byteLength(request) + 4).toString(16).padStart(4, '0')}${request}0000`;
    for (const [flag, value] of [
      ['--timeout', 4294967296],
      ['--timeout', -1],
      ['--init-timeout', 4294967296],
      ['--init-timeout', -1],
      ['--max-connections', 2147483648],
      ['--max-connections', -2147483649],
    ] as const) {
      const args = [['--serve'], ['--export-all'], [flag, value], [flag, 1]] as const;
      const argv = ['--serve', '--export-all', `${flag}=${value}`, `${flag}=1`];
      if (!native255) {
        const old = direct(['daemon', ...argv], packet);
        expect(old.error).toBeUndefined();
        expect(old.signal).toBe(null);
        expect(old.status, old.stderr).toBe(0);
        continue;
      }
      compare('daemon', args, argv, false, packet);
    }
    if (!native255) {
      context.skip();
    }
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
  it('rejects supported fsmonitor signed32 overflow before a later overwrite', (context) => {
    if (!fsmonitorAvailable || !native255) {
      context.skip();
      return;
    }
    for (const flag of ['--ipc-threads', '--start-timeout'] as const) {
      for (const value of [2147483648, -2147483649]) {
        compare(
          'fsmonitor--daemon status',
          [
            [flag, value],
            [flag, 2],
          ],
          [`${flag}=${value}`, `${flag}=2`],
          false,
        );
      }
    }
  });
  it('compares parser failures and non-running fsmonitor status on supported platforms', (context) => {
    if (!fsmonitorAvailable) {
      context.skip();
      return;
    }
    compare('fsmonitor--daemon', [], [], false);
    const invalid = direct(['fsmonitor--daemon', 'status', '--ipc-threads=0']);
    expect(invalid.error).toBeUndefined();
    expect(invalid.signal).toBe(null);
    expect(invalid.status).toBe(128);
    expect(invalid.stderr).toContain("invalid 'ipc-threads' value");
    expect(() =>
      commandArguments('fsmonitor--daemon status', [['--ipc-threads', 0]], true),
    ).toThrow(GitArgumentError);
    const status = direct(['fsmonitor--daemon', 'status', '--ipc-threads=0', '--ipc-threads=2']);
    expect(status.error).toBeUndefined();
    expect(status.signal).toBe(null);
    expect(status.status, status.stderr).toBe(1);
    expect(status.stdout).toContain('fsmonitor-daemon is not watching');
    expect(
      commandArguments(
        'fsmonitor--daemon status',
        [
          ['--ipc-threads', 0],
          ['--ipc-threads', 2],
        ],
        true,
      ),
    ).toEqual(['fsmonitor--daemon', 'status', '--ipc-threads=0', '--ipc-threads=2']);
  });
});
