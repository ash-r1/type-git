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
const unavailable = (command: string) =>
  spawnSync('git', [command, '-h'], { encoding: 'utf8' }).stderr.includes('is not a git command');
describe('import and HTTP entrypoint grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-import-http-'));
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

  it('validates fast-import callbacks immediately and accepts repeated CLI marks files', async () => {
    compare('fast-import', [], [], true);
    compare('fast-import', [{ operand: 'extra' }], ['extra'], false);
    compare('fast-import', [['--']], ['--'], false);
    for (const depth of [0, 8191, 8192, -1]) {
      compare(
        'fast-import',
        [['--depth', depth]],
        [`--depth=${depth}`],
        depth >= 0 && depth <= 8191,
      );
    }
    compare(
      'fast-import',
      [
        ['--depth', 8192],
        ['--depth', 0],
      ],
      ['--depth=8192', '--depth=0'],
      false,
    );
    compare('fast-import', [['--cat-blob-fd', 2147483648]], ['--cat-blob-fd=2147483648'], false);
    compare(
      'fast-import',
      [
        ['--date-format', 'RAW'],
        ['--date-format', 'raw'],
      ],
      ['--date-format=RAW', '--date-format=raw'],
      false,
    );
    const marks = join(root, 'marks');
    await writeFile(marks, '');
    compare(
      'fast-import',
      [
        ['--import-marks', marks],
        ['--import-marks', marks],
        ['--import-marks-if-exists', join(root, 'missing')],
      ],
      [
        `--import-marks=${marks}`,
        `--import-marks=${marks}`,
        `--import-marks-if-exists=${join(root, 'missing')}`,
      ],
      true,
    );
    compare(
      'fast-import',
      [['--quiet'], ['--stats'], ['--done']],
      ['--quiet', '--stats', '--done'],
      true,
      'done\n',
    );
  });
  it.skipIf(legacy)(
    'accepts the full import signature mode family without invoking a signer',
    () => {
      for (const value of [
        'abort',
        'verbatim',
        'strip-if-invalid',
        'sign-if-invalid=unused',
        'abort-if-invalid',
      ]) {
        compare(
          'fast-import',
          [
            ['--signed-tags', value],
            ['--signed-commits', value],
          ],
          [`--signed-tags=${value}`, `--signed-commits=${value}`],
          true,
        );
      }
      compare('fast-import', [['--signed-tags', 'STRIP']], ['--signed-tags=STRIP'], false);
    },
  );
  it.skipIf(unavailable('http-fetch'))(
    'matches HTTP fetch modes using empty target input and a local file URL',
    () => {
      const url = `file://${repo.workdir}/.git/`;
      compare('http-fetch', [], [], false);
      compare('http-fetch', [{ operand: url }], [url], false);
      compare('http-fetch', [['--stdin'], { operand: url }], ['--stdin', url], true);
      if (!legacy) {
        const oid = '0'.repeat(40);
        compare(
          'http-fetch',
          [['--packfile', oid], { operand: url }],
          [`--packfile=${oid}`, url],
          false,
        );
        compare(
          'http-fetch',
          [['--stdin'], ['--index-pack-arg', '--keep'], { operand: url }],
          ['--stdin', '--index-pack-arg=--keep', url],
          false,
        );
      }
    },
  );
  it.skipIf(unavailable('http-push'))(
    'rejects HTTP push arities before contacting a destination',
    () => {
      compare('http-push', [], [], false);
      compare(
        'http-push',
        [['--dry-run'], ['-d'], { operand: 'file:///unopened' }],
        ['--dry-run', '-d', 'file:///unopened'],
        false,
      );
      compare(
        'http-push',
        [
          ['--dry-run'],
          ['-D'],
          { operand: 'file:///unopened' },
          { operand: 'one' },
          { operand: 'two' },
        ],
        ['--dry-run', '-D', 'file:///unopened', 'one', 'two'],
        false,
      );
    },
  );
  it('preserves CGI ignored words and IMAP parse success without a server or messages', () => {
    const backendArgs = [{ operand: '--ignored' }, { operand: 'word' }];
    const argv = commandArguments('http-backend', backendArgs, true);
    const result = spawnSync('git', ['-C', repo.workdir, ...argv], {
      env: {
        ...env,
        REQUEST_METHOD: 'GET',
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: '/repo/HEAD',
      },
      encoding: 'utf8',
      input: '',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('ref: refs/heads/');
    compare('imap-send', [{ operand: 'extra' }], ['extra'], false);
    const args = legacy ? [['-q']] : [['--list'], ['--folder', 'unused'], ['--no-curl']];
    const imapArgv = commandArguments('imap-send', args, true);
    const noServer = direct(imapArgv);
    expect(noServer.status).toBe(1);
    expect(noServer.stderr).not.toContain('usage:');
    expect(noServer.stderr.toLowerCase()).toContain('imap');
  });
});
