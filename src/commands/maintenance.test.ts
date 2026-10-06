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
describe('maintenance, storage and ref command grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  let branch: string;
  const direct = (args: string[], input = '') =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input,
      encoding: 'utf8',
      timeout: 10000,
    });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-maintenance-'));
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
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    branch = direct(['symbolic-ref', 'HEAD']).stdout.trim();
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

  it.skipIf(legacy)(
    'preserves exact task spellings while validating case-insensitive task names',
    () => {
      for (const op of ['maintenance run', 'maintenance is-needed'] as const) {
        const prefix = op === 'maintenance run' ? [['--auto']] : [];
        const argvPrefix = op === 'maintenance run' ? ['--auto'] : [];
        for (const [first, second, valid] of [
          ['gc', 'gc', false],
          ['gc', 'GC', true],
          ['InCrEmEnTaL-RePaCk', 'gc', true],
          ['pacK-refs', 'gc', false],
          ['unknown', 'gc', false],
        ] as const) {
          compare(
            op,
            [...prefix, ['--task', first], ['--task', second]],
            [...argvPrefix, `--task=${first}`, `--task=${second}`],
            valid,
          );
        }
      }
      compare(
        'maintenance run',
        [['--task', 'gc'], ['--task', 'gc'], ['-h']],
        ['--task=gc', '--task=gc', '-h'],
        false,
      );
      compare(
        'maintenance run',
        [['--auto'], ['--schedule', 'daily']],
        ['--auto', '--schedule=daily'],
        false,
      );
      compare(
        'maintenance run',
        [
          ['--task', 'gc'],
          ['--schedule', 'daily'],
        ],
        ['--task=gc', '--schedule=daily'],
        false,
      );
      compare(
        'maintenance run',
        [
          ['--schedule', 'monthly'],
          ['--schedule', 'daily'],
        ],
        ['--schedule=monthly', '--schedule=daily'],
        false,
      );
      compare('maintenance run', [['--no-schedule']], ['--no-schedule'], false);
      compare('maintenance run', [['--schedule', 'DaIlY']], ['--schedule=DaIlY'], true);
    },
  );

  it.skipIf(legacy)(
    'validates scheduler callbacks without installing or stopping any scheduler',
    () => {
      for (const scheduler of ['SyStEmD-TiMeR', 'cron', 'AUTO', 'launchctl', 'schtasks']) {
        const args = [['--scheduler', scheduler], ['-h']];
        expect(commandArguments('maintenance start', args, true)).toEqual([
          'maintenance',
          'start',
          `--scheduler=${scheduler}`,
          '-h',
        ]);
        const result = direct(['maintenance', 'start', `--scheduler=${scheduler}`, '-h']);
        expect(result.stderr + result.stdout).toContain('usage:');
        expect(result.stderr).not.toContain('unrecognized');
      }
      compare(
        'maintenance start',
        [['--scheduler', 'invalid'], ['-h']],
        ['--scheduler=invalid', '-h'],
        false,
      );
      compare('maintenance start', [{ operand: 'extra' }], ['extra'], false);
      compare('maintenance stop', [{ operand: 'extra' }], ['extra'], false);
      const config = join(root, 'registration');
      compare(
        'maintenance register',
        [['--config-file', config]],
        [`--config-file=${config}`],
        true,
      );
      compare(
        'maintenance unregister',
        [['--config-file', config]],
        [`--config-file=${config}`],
        true,
      );
      compare(
        'maintenance unregister',
        [['--config-file', config], ['--force']],
        [`--config-file=${config}`, '--force'],
        true,
      );
    },
  );

  it('matches commit-graph source selection and split callback validation', () => {
    compare(
      'commit-graph write',
      legacy ? [['--reachable'], ['--split']] : [['--reachable'], ['--split', 'replace']],
      legacy ? ['--reachable', '--split'] : ['--reachable', '--split=replace'],
      true,
    );
    compare('commit-graph verify', [['--shallow']], ['--shallow'], true);
    compare(
      'commit-graph write',
      [['--reachable'], ['--stdin-packs']],
      ['--reachable', '--stdin-packs'],
      false,
    );
    compare(
      'commit-graph write',
      [['--stdin-commits'], ['--stdin-packs']],
      ['--stdin-commits', '--stdin-packs'],
      false,
    );
    compare(
      'commit-graph write',
      [
        ['--split', 'bad'],
        ['--split', 'replace'],
      ],
      ['--split=bad', '--split=replace'],
      false,
    );
    if (!legacy) {
      compare('commit-graph verify', [{ operand: 'extra' }], ['extra'], false);
    }
    compare(
      'commit-graph write',
      [['--stdin-commits']],
      ['--stdin-commits'],
      true,
      `${direct(['rev-parse', 'HEAD']).stdout.trim()}\n`,
    );
  });

  it.skipIf(legacy)('matches MIDX chain prerequisites and command operand counts', () => {
    expect(direct(['repack', '-ad']).status).toBe(0);
    compare('multi-pack-index write', [], [], true);
    compare('multi-pack-index verify', [], [], true);
    compare('multi-pack-index expire', [], [], true);
    compare('multi-pack-index repack', [['--batch-size', 1048576]], ['--batch-size=1048576'], true);
    compare(
      'multi-pack-index write',
      [['--no-write-chain-file']],
      ['--no-write-chain-file'],
      false,
    );
    compare('multi-pack-index write', [['--base', 'hash']], ['--base=hash'], false);
    compare('multi-pack-index compact', [{ operand: 'from' }], ['from'], false);
    compare(
      'multi-pack-index compact',
      [['--no-write-chain-file'], { operand: 'from' }, { operand: 'to' }],
      ['--no-write-chain-file', 'from', 'to'],
      false,
    );
    compare('multi-pack-index verify', [{ operand: 'extra' }], ['extra'], false);
  });

  it.skipIf(legacy)('matches refs subcommands and the shared listing grammar', async () => {
    compare('refs exists', [{ operand: branch }], [branch], true);
    compare('refs exists', [], [], false);
    compare('refs verify', [['--strict']], ['--strict'], true);
    compare('refs list', [['--format', '%(refname)']], ['--format=%(refname)'], true);
    compare('refs list', [['--shell'], ['--python']], ['--shell', '--python'], false);
    compare('refs migrate', [], [], false);
    compare('refs migrate', [['--ref-format', 'invalid']], ['--ref-format=invalid'], false);
    compare(
      'refs migrate',
      [['--ref-format', 'invalid'], ['--ref-format', 'reftable'], ['--dry-run']],
      ['--ref-format=invalid', '--ref-format=reftable', '--dry-run'],
      true,
    );
    compare(
      'refs optimize',
      [['--all'], ['--include', 'refs/heads/*']],
      ['--all', '--include=refs/heads/*'],
      true,
    );
    const result = await repo.command('refs list', [['--format', '%(refname)']]);
    expect(result.stdout).toContain(branch);
  });

  it('preserves independent options, aliases and extra prune heads', async () => {
    compare('gc', [['--auto']], ['--auto'], true);
    compare('gc', [{ operand: 'extra' }], ['extra'], false);
    compare('pack-refs', [['--all'], ['--no-prune']], ['--all', '--no-prune'], true);
    compare(
      'fsck',
      [['--strict'], ['--connectivity-only'], { operand: 'HEAD' }],
      ['--strict', '--connectivity-only', 'HEAD'],
      true,
    );
    compare('fsck-objects', [['--strict']], ['--strict'], true);
    compare('prune', [['--dry-run'], { operand: 'HEAD' }], ['--dry-run', 'HEAD'], true);
    compare('prune-packed', [['--dry-run'], ['--quiet']], ['--dry-run', '--quiet'], true);
    compare('prune-packed', [{ operand: 'extra' }], ['extra'], false);
    compare('update-server-info', [['--force']], ['--force'], true);
    compare('update-server-info', [{ operand: 'extra' }], ['extra'], false);
    compare('stage', [['--dry-run'], { operand: 'tracked' }], ['--dry-run', 'tracked'], true);
    compare('stage', [['--pathspec-file-nul']], ['--pathspec-file-nul'], false);
    const result = await repo.command('fsck', [['--connectivity-only']]);
    expect(result.exitCode).toBe(0);
  });
});
