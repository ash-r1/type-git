import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';

const legacy = process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true';

describe('native CLI scopes', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-native-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      GIT_TERMINAL_PROMPT: '0',
      GIT_EDITOR: 'true',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'config'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await repo.commit({ message: 'initial', allowEmpty: true });
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

  it('uses the last status format while checking porcelain values when parsed', () => {
    for (const flags of [
      [],
      ['--long'],
      ['--short'],
      ['--long', '--short'],
      ['--short', '--long'],
      ['--porcelain'],
      ['--long', '--porcelain'],
      ['--long', '--no-long'],
    ]) {
      for (const nul of [false, true]) {
        const argv = [...flags, ...(nul ? ['-z'] : [])];
        const actual = direct(['status', ...argv]);
        if (actual.status === 0) {
          expect(
            commandArguments(
              'status',
              argv.map((flag) => [flag]),
            ),
          ).toEqual(['status', ...argv]);
        } else {
          expect(() =>
            commandArguments(
              'status',
              argv.map((flag) => [flag]),
            ),
          ).toThrow(GitArgumentError);
        }
      }
    }
    expect(direct(['status', '--porcelain=bad', '--porcelain=2']).status).not.toBe(0);
    expect(() =>
      commandArguments('status', [
        ['--porcelain', 'bad'],
        ['--porcelain', '2'],
      ]),
    ).toThrow(GitArgumentError);
    expect(direct(['status', '--ignored=matching', '--untracked-files=no']).status).not.toBe(0);
    expect(() =>
      commandArguments('status', [
        ['--ignored', 'matching'],
        ['--untracked-files', 'no'],
      ]),
    ).toThrow(GitArgumentError);
    expect(commandArguments('status', [['-u', 'normal']])).toEqual(['status', '-unormal']);
    expect(direct(['status', '-unormal']).status).toBe(0);
  });

  it('checks worktree arity, output modes and orphan restrictions', async () => {
    for (const verbose of [false, true]) {
      for (const porcelain of [false, true]) {
        for (const nul of [false, true]) {
          const argv = [
            ...(verbose ? ['--verbose'] : []),
            ...(porcelain ? ['--porcelain'] : []),
            ...(nul ? ['-z'] : []),
          ];
          const actual = direct(['worktree', 'list', ...argv]);
          // Git 2.25 predates worktree list --verbose and -z.
          if (legacy && (nul || verbose)) {
            continue;
          }
          if (actual.status === 0) {
            expect(
              commandArguments(
                'worktree list',
                argv.map((flag) => [flag]),
              ),
            ).toEqual(['worktree', 'list', ...argv]);
          } else {
            expect(() =>
              commandArguments(
                'worktree list',
                argv.map((flag) => [flag]),
              ),
            ).toThrow(GitArgumentError);
          }
        }
      }
    }
    const added = await repo.command('worktree add', [
      ['--detach'],
      { operand: join(root, 'linked') },
      { operand: 'HEAD' },
    ]);
    expect(added.exitCode).toBe(0);
    expect(
      (
        await repo.command('worktree lock', [
          ['--reason', 'test'],
          { operand: join(root, 'linked') },
        ])
      ).exitCode,
    ).toBe(0);
    expect(
      (await repo.command('worktree unlock', [{ operand: join(root, 'linked') }])).exitCode,
    ).toBe(0);
    expect(
      (
        await repo.command('worktree move', [
          { operand: join(root, 'linked') },
          { operand: join(root, 'moved') },
        ])
      ).exitCode,
    ).toBe(0);
    expect(
      (await repo.command('worktree remove', [{ operand: join(root, 'moved') }])).exitCode,
    ).toBe(0);
    expect(() =>
      commandArguments('worktree add', [['--orphan'], ['--no-track'], { operand: 'dir' }]),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments('worktree add', [['--reason', 'test'], { operand: 'dir' }]),
    ).toThrow(GitArgumentError);
  });

  it('checks commit message/content modes, including dry-run exceptions and empty filenames', async () => {
    for (const [left, right] of [
      ['--all', '--only'],
      ['--include', '--interactive'],
      ['--reuse-message=HEAD', '--file=file'],
      ['--fixup=HEAD', '--squash=HEAD'],
    ]) {
      const argv = [left!, right!, '--dry-run'];
      const args = argv.map((arg) =>
        arg.includes('=')
          ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
          : [arg],
      );
      expect(direct(['commit', ...argv]).status).not.toBe(0);
      expect(() => commandArguments('commit', args)).toThrow(GitArgumentError);
    }
    const emptyFileCommit = await repo.command('commit', [
      ['--file', ''],
      ['-m', 'empty filename'],
      ['--allow-empty'],
    ]);
    // Git 2.25 treats an empty filename as a message source; 2.55 clears it.
    expect(emptyFileCommit.exitCode === 0).toBe(!legacy);
    for (const mode of ['--dry-run', '--short', '-z']) {
      const argv = ['--fixup=amend:HEAD', '-m', 'extra', mode];
      const args = [['--fixup', 'amend:HEAD'], ['-m', 'extra'], [mode]];
      const actual = direct(['commit', ...argv]);
      expect(actual.stderr).not.toContain('cannot be used together');
      expect(commandArguments('commit', args)).toEqual([
        'commit',
        '--fixup=amend:HEAD',
        '-m',
        'extra',
        mode,
      ]);
    }
  });

  it('supports clone aliases and rejects incompatible revision and bundle modes', async () => {
    const result = await repo.command('clone', [
      ['--naked'],
      { operand: repo.workdir },
      { operand: join(root, 'cloned') },
    ]);
    expect(result.exitCode).toBe(0);
    expect(
      commandArguments('clone', [
        ['--recursive'],
        ['--filter', 'blob:none'],
        ['--also-filter-submodules'],
        { operand: '.' },
      ]),
    ).toContain('--recursive');
    expect(() =>
      commandArguments('clone', [['--revision', 'HEAD'], ['--branch', 'main'], { operand: '.' }]),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments('clone', [['--bundle-uri', 'bundle'], ['--depth', '1'], { operand: '.' }]),
    ).toThrow(GitArgumentError);
    expect(() =>
      commandArguments('clone', [['--naked'], ['--separate-git-dir', 'dir'], { operand: '.' }]),
    ).toThrow(GitArgumentError);
  });
  it('matches branch action groups, implicit list filters, and independent force bits', () => {
    const cases: [string[], boolean][] = [
      [['--list'], true],
      [['--show-current', 'ignored', 'also-ignored'], true],
      [['-d', '--no-delete', '--list'], true],
      [['-D', '--no-delete', '--list'], false],
      [['--contains=HEAD', '--no-list', '-D', 'old'], false],
      [['-M', '-C', 'new'], false],
      [['-a', '-D', 'old'], false],
      [['--edit-description', 'a', 'b'], false],
      [['--track=invalid', '--track=direct', 'new'], false],
    ];
    for (const [argv, accepted] of cases) {
      const args = argv.map((arg) =>
        arg.startsWith('-')
          ? arg.includes('=')
            ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
            : [arg]
          : { operand: arg },
      );
      expect(direct(['branch', ...argv]).status === 0, argv.join(' ')).toBe(accepted);
      if (accepted) {
        expect(commandArguments('branch', args)).toEqual(['branch', ...argv]);
      } else {
        expect(() => commandArguments('branch', args), argv.join(' ')).toThrow(GitArgumentError);
      }
    }
    expect(direct(['branch', 'deletable']).status).toBe(0);
    expect(
      direct(commandArguments('branch', [['-d'], ['-D'], { operand: 'deletable' }])).status,
    ).toBe(0);
  });

  it('matches restore destinations and the order of conflict callback side effects', async () => {
    await writeFile(join(repo.workdir, 'tracked'), 'content\n');
    await repo.add('tracked');
    await repo.commit({ message: 'tracked' });
    for (const flags of [
      [],
      ['--staged'],
      ['--worktree'],
      ['--staged', '--worktree'],
      ['--no-staged'],
      ['--no-worktree'],
      ['--no-staged', '--worktree'],
      ['--ours', '--theirs'],
      ['--source=HEAD', '--ours'],
      ['--staged', '--merge'],
      ['--staged', '--no-merge', '--conflict=diff3'],
      ['--staged', '--conflict=diff3', '--no-conflict'],
      ['--staged', '--merge', '--conflict=diff3', '--no-conflict'],
    ]) {
      const args = [
        ...flags.map((arg) =>
          arg.includes('=')
            ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
            : [arg],
        ),
        { operand: 'tracked' },
      ];
      // Older restore accepted/ignored tree-stage and staged-merge combinations.
      if (
        legacy &&
        (flags.includes('--source=HEAD') ||
          (flags.includes('--staged') &&
            flags.some((flag) => flag === '--merge' || flag.startsWith('--conflict='))))
      ) {
        continue;
      }
      const actual = direct(['restore', ...flags, 'tracked']);
      if (actual.status === 0) {
        expect(commandArguments('restore', args)).toEqual(['restore', ...flags, 'tracked']);
      } else {
        expect(
          () => commandArguments('restore', args),
          `${flags.join(' ')}: ${actual.stderr}`,
        ).toThrow(GitArgumentError);
      }
    }
    for (const flags of [
      ['--discard-changes', '--conflict=diff3'],
      ['--force', '--merge', '--conflict=diff3', '--no-conflict'],
      ['--force', '--conflict=diff3', '--no-conflict'],
    ]) {
      const args = [
        ...flags.map((arg) =>
          arg.includes('=')
            ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
            : [arg],
        ),
        ['--detach'],
      ];
      const actual = direct(['switch', ...flags, '--detach']);
      if (actual.status === 0) {
        expect(commandArguments('switch', args)).toEqual(['switch', ...flags, '--detach']);
      } else {
        expect(() => commandArguments('switch', args)).toThrow(GitArgumentError);
      }
    }
  });

  it('preserves reset last-wins modes and distinguishes paths after the separator', () => {
    for (const flags of [
      ['--hard', '--mixed', '--intent-to-add'],
      ['--mixed', '--hard'],
    ]) {
      const args = [...flags.map((flag) => [flag]), ['--'], { operand: 'tracked' }];
      const actual = direct(['reset', ...flags, '--', 'tracked']);
      if (actual.status === 0) {
        expect(commandArguments('reset', args)).toEqual(['reset', ...flags, '--', 'tracked']);
      } else {
        expect(() => commandArguments('reset', args)).toThrow(GitArgumentError);
      }
    }
    expect(direct(['reset', '--mixed', '--patch']).status).not.toBe(0);
    expect(() => commandArguments('reset', [['--mixed'], ['--patch']])).toThrow(GitArgumentError);
  });

  it('preserves immediate command-mode errors instead of accepting a later cancellation', () => {
    for (const flags of [
      ['--list'],
      ['--list', '--list'],
      ['--no-list'],
      ['--list', '--no-list'],
      ['--list', '--delete', '--list'],
      ['--contains=HEAD', '--annotate', 'tag-pattern'],
    ]) {
      const args = flags.map((arg) =>
        arg.startsWith('-')
          ? arg.includes('=')
            ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
            : [arg]
          : { operand: arg },
      );
      const actual = direct(['tag', ...flags]);
      if (actual.status === 0) {
        expect(commandArguments('tag', args)).toEqual(['tag', ...flags]);
      } else {
        expect(() => commandArguments('tag', args), flags.join(' ') + actual.stderr).toThrow(
          GitArgumentError,
        );
      }
    }
    expect(
      direct(
        commandArguments('tag', [
          ['--message', 'tag message'],
          ...(legacy ? [] : [['--file', '']]),
          { operand: 'test-tag' },
        ]),
      ).status,
    ).toBe(0);
    expect(direct(commandArguments('tag', [['--delete'], { operand: 'test-tag' }])).status).toBe(0);
  });

  it('executes stash push/store/apply/pop/drop/clear and validates their operand grammars', async () => {
    await writeFile(join(repo.workdir, 'tracked'), 'stash change\n');
    expect((await repo.command('stash push', [['--message', 'saved']])).exitCode).toBe(0);
    const stash = direct(['rev-parse', 'refs/stash']).stdout.trim();
    expect((await repo.command('stash drop', [])).exitCode).toBe(0);
    expect((await repo.command('stash store', [{ operand: stash }])).exitCode).toBe(0);
    expect((await repo.command('stash apply', [])).exitCode).toBe(0);
    expect(direct(['reset', '--hard']).status).toBe(0);
    expect((await repo.command('stash pop', [])).exitCode).toBe(0);
    expect(direct(['reset', '--hard']).status).toBe(0);
    expect((await repo.command('stash clear', [])).exitCode).toBe(0);
    for (const flags of [
      ['--all', '--no-include-untracked', '--staged'],
      ['--no-include-untracked', '--all', '--staged'],
    ]) {
      if (process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true') {
        continue;
      }
      const actual = direct(['stash', 'push', ...flags]);
      if (actual.status === 0) {
        expect(
          commandArguments(
            'stash push',
            flags.map((f) => [f]),
          ),
        ).toEqual(['stash', 'push', ...flags]);
      } else {
        expect(() =>
          commandArguments(
            'stash push',
            flags.map((f) => [f]),
          ),
        ).toThrow(GitArgumentError);
      }
    }
    if (process.env.TYPE_GIT_USE_LEGACY_VERSION !== 'true') {
      const exported = await repo.command('stash export', [['--print']]);
      expect(exported.exitCode).toBe(0);
      expect(
        (await repo.command('stash import', [{ operand: exported.stdout.trim() }])).exitCode,
      ).toBe(0);
      expect(
        direct(['stash', 'export', '--print', '--to-ref=refs/stashes/export']).status,
      ).not.toBe(0);
      expect(() =>
        commandArguments('stash export', [['--print'], ['--to-ref', 'refs/stashes/export']]),
      ).toThrow(GitArgumentError);
    }
  });
});
