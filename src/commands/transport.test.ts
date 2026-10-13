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

const nativeVersion = spawnSync('git', ['version'], { encoding: 'utf8' });
const versionMatch = /git version (\d+)\.(\d+)/.exec(nativeVersion.stdout);
if (nativeVersion.error || nativeVersion.signal || nativeVersion.status !== 0 || !versionMatch) {
  throw new Error('Cannot inspect selected Git version');
}
const checkedNativeInts =
  Number(versionMatch[1]) > 2 || (Number(versionMatch[1]) === 2 && Number(versionMatch[2]) >= 55);
describe('local transport command grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-transport-'));
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

  it('requires server directories and accepts stateless advertisement', () => {
    for (const command of ['upload-pack', 'receive-pack'] as const) {
      compare(command, [], [], false);
      compare(
        command,
        [{ operand: repo.workdir }, { operand: 'extra' }],
        [repo.workdir, 'extra'],
        false,
      );
      compare(
        command,
        [['--advertise-refs'], { operand: repo.workdir }],
        ['--advertise-refs', repo.workdir],
        true,
      );
      compare(
        command,
        [['--stateless-rpc'], ['--advertise-refs'], { operand: repo.workdir }],
        ['--stateless-rpc', '--advertise-refs', repo.workdir],
        true,
      );
    }
  });
  for (const command of ['upload-pack', 'receive-pack'] as const) {
    it(`advertises ${command} through its supported HTTP alias`, (context) => {
      const actual = direct([command, '--http-backend-info-refs', repo.workdir]);
      expect(actual.signal).toBe(null);
      expect(actual.error).toBeUndefined();
      if (actual.status !== 0 && actual.stderr.includes('unknown option')) {
        context.skip();
      }
      compare(
        command,
        [['--http-backend-info-refs'], { operand: repo.workdir }],
        ['--http-backend-info-refs', repo.workdir],
        true,
      );
    });
  }
  it.skipIf(!checkedNativeInts)(
    'checks timeout integer bounds before a later valid overwrite',
    () => {
      for (const value of [-2147483649, 2147483648, -2147483648, 2147483647]) {
        compare(
          'upload-pack',
          [['--timeout', value], ['--timeout', 0], ['--advertise-refs'], { operand: repo.workdir }],
          [`--timeout=${value}`, '--timeout=0', '--advertise-refs', repo.workdir],
          value >= -2147483648 && value <= 2147483647,
        );
      }
    },
  );
  it('executes server advertisements through the public byte command API', async () => {
    for (const command of ['upload-pack', 'receive-pack'] as const) {
      const expected = direct([command, '--advertise-refs', repo.workdir]);
      expect(expected.status).toBe(0);
      const actual = await repo.command(
        command,
        [['--advertise-refs'], { operand: repo.workdir }],
        { stdout: 'bytes' },
      );
      expect(actual.exitCode, actual.stderr).toBe(0);
      expect(actual.aborted).toBe(false);
      expect(new TextDecoder().decode(actual.stdout)).toBe(expected.stdout);
    }
  });
  it('preserves fetch-pack manual option placement and permissive numeric conversion', () => {
    compare('fetch-pack', [], [], false);
    compare(
      'fetch-pack',
      [['--diag-url'], { operand: repo.workdir }],
      ['--diag-url', repo.workdir],
      true,
    );
    compare(
      'fetch-pack',
      [['--diag-url'], ['--depth', 'nonsense'], { operand: repo.workdir }],
      ['--diag-url', '--depth=nonsense', repo.workdir],
      true,
    );
    compare('fetch-pack', [['--']], ['--'], false);
    compare(
      'fetch-pack',
      [['--no-thin'], { operand: repo.workdir }],
      ['--no-thin', repo.workdir],
      false,
    );
    compare(
      'fetch-pack',
      [['--quiet'], { operand: repo.workdir }, { operand: 'HEAD' }],
      ['--quiet', repo.workdir, 'HEAD'],
      true,
    );
    expect(() =>
      commandArguments('fetch-pack', [{ operand: repo.workdir }, ['--quiet']], true),
    ).toThrow(GitArgumentError);
  });
  it('validates send modes without updating the local destination', async () => {
    const destination = join(root, 'destination.git');
    expect(
      spawnSync('git', ['init', '--bare', destination], { env, encoding: 'utf8' }).status,
    ).toBe(0);
    compare('send-pack', [], [], false);
    compare(
      'send-pack',
      [['--dry-run'], ['--all'], ['--mirror'], { operand: destination }],
      ['--dry-run', '--all', '--mirror', destination],
      false,
    );
    for (const mode of ['--all', '--mirror']) {
      compare(
        'send-pack',
        [['--dry-run'], [mode], { operand: destination }, { operand: 'HEAD:refs/heads/preview' }],
        ['--dry-run', mode, destination, 'HEAD:refs/heads/preview'],
        false,
      );
      compare(
        'send-pack',
        [['--dry-run'], [mode], { operand: destination }],
        ['--dry-run', mode, destination],
        true,
      );
    }
    compare(
      'send-pack',
      [
        ['--dry-run'],
        ['--all'],
        ['--no-all'],
        { operand: destination },
        { operand: 'HEAD:refs/heads/preview' },
      ],
      ['--dry-run', '--all', '--no-all', destination, 'HEAD:refs/heads/preview'],
      true,
    );
    compare(
      'send-pack',
      [['--dry-run'], ['--signed', 'unknown'], { operand: destination }],
      ['--dry-run', '--signed=unknown', destination],
      false,
    );
    const refs = spawnSync('git', ['--git-dir', destination, 'for-each-ref'], {
      env,
      encoding: 'utf8',
    });
    expect(refs.status).toBe(0);
    expect(refs.stdout).toBe('');
  });
  it('keeps helper names and URLs literal while checking their arity', () => {
    for (const [command, url] of [
      ['remote-ext', 'true'],
      ['remote-fd', '0,1/label'],
    ] as const) {
      compare(command, [], [], false);
      compare(command, [{ operand: 'origin' }], ['origin'], false);
      compare(
        command,
        [{ operand: '--literal-name' }, { operand: url }],
        ['--literal-name', url],
        true,
        'capabilities\n',
      );
      compare(
        command,
        [{ operand: 'origin' }, { operand: url }, { operand: 'extra' }],
        ['origin', url, 'extra'],
        false,
      );
    }
  });
});
