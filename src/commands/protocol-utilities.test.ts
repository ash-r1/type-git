import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';
describe('protocol and text utility grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-protocol-utilities-'));
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
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
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

  it('matches mail parsing, attached splitting options and final trailer state', async () => {
    const message = join(root, 'message');
    const patch = join(root, 'patch');
    const mail = 'From: Test <test@example.com>\nSubject: Test\n\nBody\n';
    compare(
      'mailinfo',
      [['-u'], ['-n'], { operand: message }, { operand: patch }],
      ['-u', '-n', message, patch],
      true,
      mail,
    );
    if (!legacy) {
      compare(
        'mailinfo',
        [
          ['--quoted-cr', 'STRIP'],
          ['--quoted-cr', 'strip'],
          { operand: message },
          { operand: patch },
        ],
        ['--quoted-cr=STRIP', '--quoted-cr=strip', message, patch],
        false,
        mail,
      );
    }
    compare(
      'mailsplit',
      [
        ['-d', 4],
        ['-f', 0],
        ['-o', root],
      ],
      ['-d4', '-f0', `-o${root}`],
      true,
    );
    compare('mailsplit', [{ operand: root }], [root], true);
    compare(
      'mailsplit',
      [
        ['-d', 2],
        ['-o', root],
      ],
      ['-d2', `-o${root}`],
      false,
    );
    compare('mailsplit', [], [], false);
    compare(
      'interpret-trailers',
      [
        ['--if-exists', 'AdDiFdIfFeReNtNeIgHbOr'],
        ['--trailer', 'Acked-by: Test'],
      ],
      ['--if-exists=AdDiFdIfFeReNtNeIgHbOr', '--trailer=Acked-by: Test'],
      true,
      'Subject\n\nBody\n',
    );
    compare(
      'interpret-trailers',
      [['--parse'], ['--trailer', 'Acked-by: Test']],
      ['--parse', '--trailer=Acked-by: Test'],
      false,
    );
    compare(
      'interpret-trailers',
      [['--parse'], ['--no-only-input'], ['--trailer', 'Acked-by: Test']],
      ['--parse', '--no-only-input', '--trailer=Acked-by: Test'],
      true,
      'Subject\n',
    );
    compare(
      'interpret-trailers',
      [['--trailer', 'Acked-by: Test'], ['--no-trailer'], ['--parse']],
      ['--trailer=Acked-by: Test', '--no-trailer', '--parse'],
      true,
      'Subject\n',
    );
    compare('interpret-trailers', [['--in-place']], ['--in-place'], false);
    expect(await readFile(message, 'utf8')).toContain('Body');
  });

  it.skipIf(legacy)('matches hook name validation and required argument separators', async () => {
    const hook = join(repo.workdir, '.git', 'hooks', 'pre-commit');
    await writeFile(hook, '#!/bin/sh\nexit 0\n');
    await chmod(hook, 0o755);
    compare('hook list', [{ operand: 'pre-commit' }], ['pre-commit'], true);
    compare(
      'hook run',
      [{ operand: 'pre-commit' }, ['--'], { operand: 'extra' }],
      ['pre-commit', '--', 'extra'],
      true,
    );
    compare(
      'hook run',
      [{ operand: 'pre-commit' }, { operand: 'extra' }],
      ['pre-commit', 'extra'],
      false,
    );
    compare('hook run', [['--'], { operand: 'pre-commit' }], ['--', 'pre-commit'], false);
    compare(
      'hook run',
      [['--jobs', -2], { operand: 'pre-commit' }],
      ['--jobs=-2', 'pre-commit'],
      false,
    );
    compare(
      'hook run',
      [['--ignore-missing'], { operand: 'custom' }],
      ['--ignore-missing', 'custom'],
      false,
    );
    compare(
      'hook run',
      [['--allow-unknown-hook-name'], ['--ignore-missing'], { operand: 'custom' }],
      ['--allow-unknown-hook-name', '--ignore-missing', 'custom'],
      true,
    );
  });

  it('checks credential grammar with only fixture values and isolated storage', () => {
    const input =
      'protocol=https\nhost=example.invalid\nusername=fixture\npassword=fixture-only\n\n';
    compare('credential', [{ operand: 'fill' }], ['fill'], true, input);
    for (const command of ['credential fill', 'credential approve', 'credential reject'] as const) {
      compare(command, [], [], true, input);
    }
    compare('credential', [{ operand: 'unknown' }], ['unknown'], false, input);
    const file = join(root, 'credentials');
    for (const action of ['store', 'get', 'erase', 'unknown']) {
      compare(
        'credential-store',
        [['--file', file], { operand: action }],
        [`--file=${file}`, action],
        true,
        input,
      );
    }
    compare('credential-store', [], [], false);
    compare(
      'credential-cache',
      [['--socket', join(root, 'nonexistent')], { operand: 'unknown' }, { operand: 'ignored' }],
      [`--socket=${join(root, 'nonexistent')}`, 'unknown', 'ignored'],
      true,
    );
    // No daemon is started: this checks the missing-socket-argument path.
    compare('credential-cache--daemon', [], [], false);
    if (!legacy) {
      compare('credential capability', [], [], true);
    }
  });

  it.skipIf(legacy)(
    'checks URL component selection and the checkout worker flush protocol',
    async () => {
      compare(
        'url-parse',
        [
          ['--component', 'bad'],
          ['--component', 'host'],
          { operand: 'https://example.invalid/path' },
        ],
        ['--component=bad', '--component=host', 'https://example.invalid/path'],
        true,
      );
      compare(
        'url-parse',
        [['--component', 'bad'], { operand: 'https://example.invalid' }],
        ['--component=bad', 'https://example.invalid'],
        false,
      );
      compare('url-parse', [], [], false);
      compare('checkout--worker', [], [], true, '0000');
      compare('checkout--worker', [{ operand: 'extra' }], ['extra'], false);
      const result = await repo.command('checkout--worker', [], { stdin: '0000' });
      expect(result.stdout).toBe('0000');
    },
  );

  it('matches native helper operand counts with local archive protocol fixtures', () => {
    compare('merge-ours', [{ operand: 'ignored' }], ['ignored'], true);
    const blob = direct(['rev-parse', 'HEAD:tracked']).stdout.trim();
    const args = [blob, '', blob, 'absent', '100644', '', '100644'];
    compare(
      'merge-one-file',
      args.map((operand) => ({ operand })),
      args,
      true,
    );
    compare('merge-one-file', [], [], false);
    const oid = direct(['rev-parse', 'HEAD']).stdout.trim();
    const header = Buffer.alloc(1024);
    header.write('g', 156);
    header.write(`52 comment=${oid}\n`, 512);
    compare('get-tar-commit-id', [], [], true, header.toString('utf8'));
    compare('get-tar-commit-id', [{ operand: 'extra' }], ['extra'], false);
    const payload = 'argument --list\n';
    const request = `${(Buffer.byteLength(payload) + 4).toString(16).padStart(4, '0')}${payload}0000`;
    for (const command of ['upload-archive', 'upload-archive--writer'] as const) {
      compare(command, [{ operand: repo.workdir }], [repo.workdir], true, request);
      compare(command, [], [], false);
    }
  });
});
