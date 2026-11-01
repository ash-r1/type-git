import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

// Match the bounded Windows native process allowance used by send-email.
const nativeTimeout: number = process.platform === 'win32' ? 20000 : 10000;
/** Observe native command availability; failed processes are errors, never missing commands. */
const unavailable = (command: string) => {
  if (command === 'http-backend') {
    const listing = spawnSync('git', ['--list-cmds=main'], {
      encoding: 'utf8',
      timeout: nativeTimeout,
    });
    if (listing.error || listing.signal || listing.status !== 0) {
      throw new Error('Cannot inspect Git command inventory');
    }
    return !listing.stdout.split(/\s+/).includes(command);
  }
  const probeStarted = performance.now();
  const result = spawnSync('git', [command, '-h'], {
    encoding: 'utf8',
    timeout: nativeTimeout,
    env: { ...process.env, LC_ALL: 'C' },
  });
  if (result.error || result.signal || result.status === null) {
    throw new Error(
      `Cannot inspect ${command} availability: ${JSON.stringify({ elapsedMs: Math.round(performance.now() - probeStarted), error: result.error?.message, status: result.status, signal: result.signal, stderr: result.stderr })}`,
    );
  }
  const text = result.stdout + result.stderr;
  if (text.includes('is not a git command')) {
    if (result.status !== 1) {
      throw new Error(`Unexpected missing-command status for ${command}`);
    }
    return true;
  }
  if (!([0, 129].includes(result.status) && text.includes('usage:'))) {
    throw new Error(`Cannot inspect ${command} help`);
  }
  return false;
};
describe('import and HTTP entrypoint grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let signingModes: boolean;
  let packedFetch: boolean;
  let imapList: boolean;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: nativeTimeout,
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
      LC_ALL: 'C',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    const signingProbe = direct([
      'fast-import',
      '--signed-tags=verbatim',
      '--signed-commits=verbatim',
    ]);
    expect(signingProbe.error).toBeUndefined();
    expect(signingProbe.signal).toBe(null);
    signingModes = signingProbe.status === 0;
    if (!signingModes) {
      expect(signingProbe.status).toBe(128);
      expect(signingProbe.stderr).toContain('unknown option --signed-');
    }
    const fetchHelp = direct(['http-fetch', '-h']);
    expect(fetchHelp.error).toBeUndefined();
    expect(fetchHelp.signal).toBe(null);
    packedFetch = false;
    if (!unavailable('http-fetch')) {
      const url = `${pathToFileURL(join(repo.workdir, '.git')).href}/`;
      const packProbe = direct(['http-fetch', '--stdin', '--index-pack-arg=--keep', url]);
      expect(packProbe.error).toBeUndefined();
      expect(packProbe.signal).toBe(null);
      packedFetch =
        packProbe.stderr.includes('requires') && packProbe.stderr.includes('--packfile');
      if (packedFetch) {
        expect(packProbe.status).toBe(128);
      } else {
        expect(packProbe.status, packProbe.stderr).toBe(0);
      }
    }
    const imapHelp = direct(['imap-send', '-h']);
    expect(imapHelp.error).toBeUndefined();
    expect(imapHelp.signal).toBe(null);
    imapList = (imapHelp.stdout + imapHelp.stderr).includes('--list');
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
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
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
  it('imports a binary blob through the public byte API and verifies native object contents', async () => {
    const payload = Buffer.from([0, 255, 128, 195, 40, 10, 13, 66]);
    const stream = Buffer.concat([
      Buffer.from(`blob\nmark :1\ndata ${payload.length}\n`),
      payload,
      Buffer.from(
        '\ncommit refs/heads/imported\ncommitter Test <test@example.com> 0 +0000\ndata 6\nimport\nM 100644 :1 binary\ndone\n',
      ),
    ]);
    const imported = await repo.command('fast-import', [['--quiet'], ['--done']], {
      stdin: new Uint8Array(stream),
      stdout: 'bytes',
    });
    expect(imported.exitCode, imported.stderr).toBe(0);
    expect(imported.aborted).toBe(false);
    expect(imported.stdout).toBeInstanceOf(Uint8Array);
    const blob = spawnSync(
      'git',
      ['-C', repo.workdir, 'cat-file', 'blob', 'refs/heads/imported:binary'],
      { env, timeout: nativeTimeout },
    );
    expect(blob.error).toBeUndefined();
    expect(blob.signal).toBe(null);
    expect(blob.status, blob.stderr.toString()).toBe(0);
    expect(blob.stdout).toEqual(payload);
  });
  it('preserves native-dependent fast-import separator support', (context) => {
    const args = [['--']] as const;
    expect(commandArguments('fast-import', args, true)).toEqual(['fast-import', '--']);
    const result = direct(['fast-import', '--']);
    expect(result.error).toBeUndefined();
    expect(result.signal).toBe(null);
    if (result.status !== 0) {
      expect(result.status).toBe(129);
      expect(result.stdout + result.stderr).toContain('usage: git fast-import');
      context.skip();
      return;
    }
    expect(result.status).toBe(0);
  });
  it('accepts import signature callbacks without invoking a signer', (context) => {
    if (!signingModes) {
      context.skip();
      return;
    }
    for (const value of [
      'abort',
      'verbatim',
      'strip-if-invalid',
      'sign-if-invalid=unused',
      'sign-if-invalid=',
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
    for (const flag of ['--signed-tags', '--signed-commits'] as const) {
      compare('fast-import', [[flag, 'STRIP']], [`${flag}=STRIP`], false);
      compare(
        'fast-import',
        [
          [flag, 'invalid'],
          [flag, 'verbatim'],
        ],
        [`${flag}=invalid`, `${flag}=verbatim`],
        false,
      );
    }
  });
  it.skipIf(unavailable('http-fetch'))(
    'matches HTTP fetch modes using empty target input and a local file URL',
    () => {
      const url = `${pathToFileURL(join(repo.workdir, '.git')).href}/`;
      compare('http-fetch', [], [], false);
      compare('http-fetch', [{ operand: url }], [url], false);
      compare('http-fetch', [['--stdin'], { operand: url }], ['--stdin', url], true);
    },
  );
  it('validates supported HTTP pack prerequisites independently of legacy environment flags', (context) => {
    if (unavailable('http-fetch') || !packedFetch) {
      context.skip();
      return;
    }
    const url = `${pathToFileURL(join(repo.workdir, '.git')).href}/`;
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
  });
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
  it.skipIf(unavailable('http-backend'))(
    'preserves CGI ignored words with a controlled local HEAD request',
    () => {
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
        timeout: nativeTimeout,
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('ref: refs/heads/');
    },
  );
  it('distinguishes IMAP configuration failure from parser rejection without a server or messages', (context) => {
    if (unavailable('imap-send')) {
      context.skip();
      return;
    }
    compare('imap-send', [{ operand: 'extra' }], ['extra'], false);
    const args = imapList ? [['--list'], ['--folder', 'unused'], ['--no-curl']] : [['-q']];
    const imapArgv = commandArguments('imap-send', args, true);
    const noServer = direct(imapArgv);
    expect(noServer.status).toBe(1);
    expect(noServer.stderr).not.toContain('usage:');
    expect(noServer.stderr.toLowerCase()).toContain('imap');
  });
});
