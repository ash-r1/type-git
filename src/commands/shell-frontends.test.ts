import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('native shell frontends', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-shell-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      FILTER_BRANCH_SQUELCH_WARNING: '1',
      GIT_INTERNAL_GETTEXT_TEST_FALLBACKS: '1',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    await mkdir(join(root, 'git-shell-commands'));
    const fixture = join(root, 'git-shell-commands', 'fixture');
    await writeFile(fixture, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    await chmod(fixture, 0o755);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (argv: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...argv], {
      env,
      encoding: 'utf8',
      input: '',
      timeout: 10000,
    });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    words: string[],
    valid: boolean,
  ) => {
    const argv = [...command.split(' '), ...words];
    const actual = direct(argv);
    const label = `${argv.join(' ')}: ${actual.stderr}`;
    expect(actual.error, label).toBeUndefined();
    expect(actual.signal, label).toBe(null);
    expect(actual.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual(argv);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };
  it('runs git-shell custom commands without restricting them to built-in service names', () => {
    compare('shell', [['-c', 'fixture hello']], ['-c', 'fixture hello'], true);
    compare(
      'shell',
      [
        ['-c', 'fixture'],
        ['-c', 'fixture'],
      ],
      ['-c', 'fixture', '-c', 'fixture'],
      false,
    );
    compare('shell', [['-c', 'fixture'], { operand: 'extra' }], ['-c', 'fixture', 'extra'], false);
    compare('shell', [{ operand: 'unknown' }], ['unknown'], false);
    compare('shell', [], [], true);
    expect(direct(['shell', '-c', 'fixture hello']).stdout).toBe('hello\n');
  });
  it('matches filter-branch conflicts including an empty commit filter', () => {
    compare(
      'filter-branch',
      [['--prune-empty'], ['--commit-filter', '']],
      ['--prune-empty', '--commit-filter', ''],
      false,
    );
    compare(
      'filter-branch',
      [['--prune-empty'], ['--commit-filter', 'git commit-tree "$@"']],
      ['--prune-empty', '--commit-filter', 'git commit-tree "$@"'],
      false,
    );
    const before = direct(['rev-parse', 'HEAD']).stdout;
    compare(
      'filter-branch',
      [['--env-filter', ':'], ['--'], { operand: 'HEAD' }],
      ['--env-filter', ':', '--', 'HEAD'],
      true,
    );
    expect(direct(['rev-parse', 'HEAD']).stdout).toBe(before);
  });
  it('preserves quilt trailing words and an empty author using an empty series', async () => {
    const patches = join(root, 'patches');
    await mkdir(patches);
    await writeFile(join(patches, 'series'), '');
    compare(
      'quiltimport',
      [['--dry-run'], ['--patches', patches], ['--author', ''], { operand: 'ignored' }],
      ['--dry-run', `--patches=${patches}`, '--author=', 'ignored'],
      true,
    );
    compare('quiltimport', [['--no-dry-run']], ['--no-dry-run'], false);
  });
  it('validates every instaweb action without starting a web server', () => {
    compare('instaweb', [['--stop'], { operand: 'unknown' }], ['--stop', 'unknown'], false);
    compare('instaweb', [{ operand: 'stop' }, { operand: 'unknown' }], ['stop', 'unknown'], false);
    compare('instaweb', [['--start'], ['--stop']], ['--start', '--stop'], true);
    compare(
      'instaweb',
      [['--port', 'arbitrary'], { operand: 'stop' }],
      ['--port=arbitrary', 'stop'],
      true,
    );
    compare('instaweb stop', [], [], true);
  });
  it('sources shell libraries instead of treating non-executable files as Git commands', () => {
    const execPath = spawnSync('git', ['--exec-path'], { env, encoding: 'utf8' }).stdout.trim();
    for (const name of ['sh-i18n', 'sh-setup']) {
      const result = spawnSync(
        'sh',
        ['-c', '. "$1"; printf library-loaded', '_', join(execPath, `git-${name}`)],
        {
          cwd: repo.workdir,
          env: { ...env, PATH: `${execPath}:${env.PATH}` },
          encoding: 'utf8',
          timeout: 10000,
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('library-loaded');
    }
  });
});
