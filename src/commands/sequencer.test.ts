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
describe('merge, rebase and sequencer parser grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-sequencer-'));
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
      GIT_SEQUENCE_EDITOR: 'true',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('tracked');
    await repo.commit({ message: 'initial' });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
  const compare = (command: GitCommandName, args: readonly unknown[], argv: string[]) => {
    const actual = direct([command, ...argv]);
    expect(actual.signal, argv.join(' ')).toBe(null);
    if (actual.status === 0) {
      expect(commandArguments(command, args)).toEqual([command, ...argv]);
    } else {
      expect(() => commandArguments(command, args), `${argv.join(' ')}: ${actual.stderr}`).toThrow(
        GitArgumentError,
      );
    }
  };
  it('checks original merge argument count and the last fast-forward mode', () => {
    for (const flags of [
      ['--quit'],
      ['--quit', '--quit'],
      ['--quit', '--stat'],
      ['--quit', '--'],
      ['--squash', '--no-ff'],
      ['--no-ff', '--ff-only', '--squash'],
      ['--squash', '--commit'],
      ['--squash', '--commit', '--no-commit'],
    ]) {
      const continuation = flags.includes('--quit');
      compare(
        'merge',
        [...flags.map((f) => [f]), ...(continuation ? [] : [{ operand: 'HEAD' }])],
        [...flags, ...(continuation ? [] : ['HEAD'])],
      );
    }
    compare(
      'merge',
      [['--cleanup', 'bad'], ['--cleanup', 'strip'], { operand: 'HEAD' }],
      ['--cleanup=bad', '--cleanup=strip', 'HEAD'],
    );
    compare('merge', [['--cleanup', 'bad'], { operand: 'HEAD' }], ['--cleanup=bad', 'HEAD']);
  });
  it.skipIf(legacy)(
    'checks immediate backend changes, implied backends and case-insensitive rebase enums',
    () => {
      for (const flags of [
        ['--apply', '--merge'],
        ['--merge', '--apply'],
        ['--interactive', '--merge'],
        ['--apply', '--keep-empty'],
        ['--no-keep-empty', '--apply'],
        ['--apply', '--no-reapply-cherry-picks'],
        ['--apply', '--keep-base', '--no-reapply-cherry-picks'],
        ['--apply', '--autosquash'],
        ['--apply', '--autosquash', '--no-autosquash'],
        ['--apply', '--update-refs'],
        ['--apply', '--update-refs', '--no-update-refs'],
        ['--apply', '--reschedule-failed-exec'],
        ['--reschedule-failed-exec'],
        ['--preserve-merges'],
        ['--preserve-merges', '--no-preserve-merges'],
        ['--keep-base', '--root'],
        ['--root', '--fork-point'],
      ]) {
        compare('rebase', [...flags.map((f) => [f]), { operand: 'HEAD' }], [...flags, 'HEAD']);
      }
      compare(
        'rebase',
        [['-C', '2'], ['--ignore-whitespace'], { operand: 'HEAD' }],
        ['-C', '2', '--ignore-whitespace', 'HEAD'],
      );
      compare(
        'rebase',
        [['-C', '2'], ['--ignore-whitespace'], ['--apply'], { operand: 'HEAD' }],
        ['-C', '2', '--ignore-whitespace', '--apply', 'HEAD'],
      );
      compare(
        'rebase',
        [['--root'], { operand: 'HEAD' }, { operand: 'HEAD' }],
        ['--root', 'HEAD', 'HEAD'],
      );
      for (const value of ['KEEP', 'sToP', 'AsK', 'invalid', 'ASK']) {
        compare('rebase', [['--empty', value], { operand: 'HEAD' }], [`--empty=${value}`, 'HEAD']);
      }
      compare(
        'rebase',
        [['--apply'], ['--empty', 'keep'], { operand: 'HEAD' }],
        ['--apply', '--empty=keep', 'HEAD'],
      );
      compare(
        'rebase',
        [['--keep-base'], ['--onto', 'HEAD'], { operand: 'HEAD' }],
        ['--keep-base', '--onto=HEAD', 'HEAD'],
      );
    },
  );
  it('distinguishes sequencer continuation options from merge continuation options', async () => {
    for (const name of ['cherry-pick', 'revert'] as const) {
      for (const flags of [
        ['--quit'],
        ['--quit', '--quit'],
        ['--quit', '--edit'],
        ['--quit', '--signoff'],
        ['--quit', '--no-commit'],
        ['--quit', '--rerere-autoupdate'],
        ['--quit', '--no-rerere-autoupdate'],
      ]) {
        compare(
          name,
          flags.map((f) => [f]),
          flags,
        );
      }
      if (legacy) {
        expect(direct([name, '--quit', '--strategy=unused']).status).not.toBe(0);
      } else {
        compare(name, [['--quit'], ['--strategy', 'unused']], ['--quit', '--strategy=unused']);
      }
      compare(name, [['--quit'], ['--strategy-option', '']], ['--quit', '--strategy-option=']);
      if (legacy) {
        expect(
          direct([name, '--quit', '--strategy-option=unused', '--no-strategy-option']).status,
        ).not.toBe(0);
      } else {
        compare(
          name,
          [['--quit'], ['--strategy-option', 'unused'], ['--no-strategy-option']],
          ['--quit', '--strategy-option=unused', '--no-strategy-option'],
        );
      }
      compare(name, [['--quit'], ['--max-count', 1]], ['--quit', '--max-count=1']);
      expect((await repo.command(name, [['--quit'], ['-S']])).exitCode).toBe(0);
      expect(() => commandArguments(name, [])).toThrow(GitArgumentError);
    }
    compare(
      'cherry-pick',
      [['--ff'], ['--signoff'], { operand: 'HEAD' }],
      ['--ff', '--signoff', 'HEAD'],
    );
    compare('cherry-pick', [['--ff'], ['--edit'], { operand: 'HEAD' }], ['--ff', '--edit', 'HEAD']);
  });
  it('matches mainline conversion before a later clear can mask invalid input', () => {
    for (const value of [1, 0, -1, 2147483647, 2147483648, 4294967296, 4294967297, -4294967295]) {
      compare(
        'cherry-pick',
        [['--mainline', value], ['--no-mainline'], ['--quit']],
        [`--mainline=${value}`, '--no-mainline', '--quit'],
      );
    }
  });
  it('supports merge-base modes and concatenated commit-tree messages', async () => {
    expect(
      (await repo.command('merge-base', [{ operand: 'HEAD' }, { operand: 'HEAD' }])).exitCode,
    ).toBe(0);
    expect((await repo.command('merge-base', [['--independent']])).exitCode).toBe(1);
    expect(
      (await repo.command('merge-base', [['--all'], ['--fork-point'], { operand: 'HEAD' }]))
        .exitCode,
    ).toBe(0);
    compare(
      'merge-base',
      [['--all'], ['--is-ancestor'], { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--all', '--is-ancestor', 'HEAD', 'HEAD'],
    );
    compare(
      'merge-base',
      [['--is-ancestor'], { operand: 'HEAD' }, { operand: 'HEAD' }, { operand: 'HEAD' }],
      ['--is-ancestor', 'HEAD', 'HEAD', 'HEAD'],
    );
    compare(
      'merge-base',
      [['--octopus'], ['--independent'], { operand: 'HEAD' }],
      ['--octopus', '--independent', 'HEAD'],
    );
    const file = join(root, 'message');
    await writeFile(file, 'file paragraph\n');
    const result = await repo.command('commit-tree', [
      ['-p', 'HEAD'],
      ['-m', 'first paragraph'],
      ['-F', file],
      { operand: 'HEAD^{tree}' },
    ]);
    expect(result.exitCode).toBe(0);
    const commit = direct(['cat-file', '-p', result.stdout.trim()]).stdout;
    expect(commit).toContain('first paragraph');
    expect(commit).toContain('file paragraph');
    compare('commit-tree', [], []);
  });
});
