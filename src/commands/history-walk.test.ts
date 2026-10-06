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
describe('history walking, bundles and repository inspection grammars', () => {
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
    root = await mkdtemp(join(tmpdir(), 'type-git-history-walk-'));
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
    await writeFile(join(repo.workdir, 'second'), 'two\n');
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

  it('matches revision sources, suppressed diff output and explicit notes state', () => {
    compare('rev-list', [{ operand: 'HEAD' }], ['HEAD'], true);
    compare('rev-list', [['--count'], ['--all']], ['--count', '--all'], true);
    compare('rev-list', [['--objects']], ['--objects'], true);
    compare('rev-list', [['--stdin']], ['--stdin'], true, 'HEAD\n');
    compare('rev-list', [], [], false);
    compare('rev-list', [['-p'], { operand: 'HEAD' }], ['-p', 'HEAD'], false);
    if (!legacy) {
      // Git 2.25 rejects patch output even when later suppressed.
      compare('rev-list', [['-p'], ['-s'], { operand: 'HEAD' }], ['-p', '-s', 'HEAD'], true);
    }
    compare('rev-list', [['--notes'], { operand: 'HEAD' }], ['--notes', 'HEAD'], false);
    compare(
      'rev-list',
      [['--notes'], ['--no-notes'], { operand: 'HEAD' }],
      ['--notes', '--no-notes', 'HEAD'],
      true,
    );
    compare(
      'rev-list',
      [['--show-notes-by-default'], { operand: 'HEAD' }],
      ['--show-notes-by-default', 'HEAD'],
      false,
    );
    if (!legacy) {
      // Git 2.25 does not mark --standard-notes as an explicit notes selection.
      compare(
        'rev-list',
        [['--show-notes-by-default'], ['--standard-notes'], { operand: 'HEAD' }],
        ['--show-notes-by-default', '--standard-notes', 'HEAD'],
        true,
      );
    }
    if (!legacy) {
      // The marked-object count restriction was added after Git 2.25.
      compare(
        'rev-list',
        [['--objects'], ['--count'], ['--cherry-mark'], { operand: 'HEAD' }],
        ['--objects', '--count', '--cherry-mark', 'HEAD'],
        false,
      );
    }
  });

  it.skipIf(legacy)('matches the missing-action prescan and NUL-output conflicts', () => {
    for (const values of [['unknown'], ['print', 'error'], ['print', 'unknown']]) {
      const valid = values[0] !== 'print' || values[1] === 'error';
      compare(
        'rev-list',
        [
          ['--exclude-promisor-objects'],
          ...values.map((value) => ['--missing', value]),
          { operand: 'HEAD' },
        ],
        ['--exclude-promisor-objects', ...values.map((value) => `--missing=${value}`), 'HEAD'],
        valid,
      );
    }
    compare('rev-list', [['-z'], { operand: 'HEAD' }], ['-z', 'HEAD'], true);
    for (const flag of [
      '--header',
      '--left-right',
      '--timestamp',
      '--use-bitmap-index',
      '--objects-edge',
    ]) {
      compare('rev-list', [['-z'], [flag], { operand: 'HEAD' }], ['-z', flag, 'HEAD'], false);
    }
    compare(
      'rev-list',
      [['-z'], ['--pretty', 'oneline'], { operand: 'HEAD' }],
      ['-z', '--pretty=oneline', 'HEAD'],
      false,
    );
    compare(
      'rev-list',
      [['--disk-usage', 'human'], { operand: 'HEAD' }],
      ['--disk-usage=human', 'HEAD'],
      true,
    );
    compare(
      'rev-list',
      [['--disk-usage', 'bad'], { operand: 'HEAD' }],
      ['--disk-usage=bad', 'HEAD'],
      false,
    );
  });

  it('preserves shared native case-insensitive diff algorithms', () => {
    for (const command of ['diff', 'log'] as const) {
      compare(command, [['--diff-algorithm', 'DeFaUlT']], ['--diff-algorithm=DeFaUlT'], true);
      compare(command, [['--diff-algorithm', 'HiStOgRaM']], ['--diff-algorithm=HiStOgRaM'], true);
      compare(command, [['--diff-algorithm', 'unknown']], ['--diff-algorithm=unknown'], false);
    }
  });

  it('matches bundle dispatch before the output path and revision words after it', () => {
    const file = join(root, 'test.bundle');
    const version = legacy ? [] : [['--version', 3]];
    const versionArgv = legacy ? [] : ['--version=3'];
    compare(
      'bundle create',
      [...version, { operand: file }, { operand: '--all' }],
      [...versionArgv, file, '--all'],
      true,
    );
    compare('bundle verify', [{ operand: file }, { operand: 'ignored' }], [file, 'ignored'], true);
    compare('bundle list-heads', [{ operand: file }], [file], true);
    compare('bundle unbundle', [{ operand: file }], [file], true);
    compare('bundle verify', [], [], false);
    if (!legacy) {
      compare(
        'bundle create',
        [['--version', 4], { operand: join(root, 'bad.bundle') }, { operand: '--all' }],
        ['--version=4', join(root, 'bad.bundle'), '--all'],
        false,
      );
      compare(
        'bundle create',
        [['--no-version'], { operand: join(root, 'bad2.bundle') }, { operand: '--all' }],
        ['--no-version', join(root, 'bad2.bundle'), '--all'],
        false,
      );
    }
  });

  it.skipIf(legacy)(
    'matches history callbacks using dry runs in an isolated repository',
    async () => {
      for (const command of ['history fixup', 'history reword', 'history split'] as const) {
        if (command === 'history fixup') {
          await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
          expect(direct(['add', 'tracked']).status).toBe(0);
        }
        compare(
          command,
          [['--dry-run'], ['--update-refs', 'head'], { operand: 'HEAD' }],
          ['--dry-run', '--update-refs=head', 'HEAD'],
          true,
          command === 'history split' ? 'y\nn\n' : '',
        );
        if (command === 'history fixup') {
          expect(direct(['reset', '--hard', 'HEAD']).status).toBe(0);
        }
        compare(command, [], [], false);
        compare(
          command,
          [['--update-refs', 'HEAD'], { operand: 'HEAD' }],
          ['--update-refs=HEAD', 'HEAD'],
          false,
        );
      }
      compare(
        'history fixup',
        [['--empty', 'KEEP'], ['--dry-run'], { operand: 'HEAD' }],
        ['--empty=KEEP', '--dry-run', 'HEAD'],
        false,
      );
    },
  );

  it.skipIf(legacy)('matches repository inspection modes and last-wins formatting', async () => {
    compare(
      'repo info',
      [['--format', 'table'], ['-z'], ['--keys']],
      ['--format=table', '-z', '--keys'],
      true,
    );
    compare('repo info', [{ operand: 'object.format' }], ['object.format'], true);
    compare('repo info', [['--format', 'table']], ['--format=table'], false);
    compare(
      'repo info',
      [['--all'], { operand: 'object.format' }],
      ['--all', 'object.format'],
      false,
    );
    compare('repo info', [['--all'], ['--keys']], ['--all', '--keys'], false);
    compare('repo structure', [['--format', 'table']], ['--format=table'], true);
    compare(
      'repo structure',
      [
        ['--format', 'unknown'],
        ['--format', 'lines'],
      ],
      ['--format=unknown', '--format=lines'],
      false,
    );
    const result = await repo.command('repo info', [{ operand: 'object.format' }]);
    expect(result.stdout).toContain('object.format=sha1');
  });
});
