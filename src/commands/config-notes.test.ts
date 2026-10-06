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
describe('config and notes command grammars', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-config-notes-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      GIT_EDITOR: 'true',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'global'), '');
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

  it.skipIf(legacy)(
    'round-trips dash-prefixed config values after option parsing has stopped',
    async () => {
      expect(
        (await repo.command('config set', [{ operand: 'test.value' }, { operand: '--literal' }]))
          .exitCode,
      ).toBe(0);
      expect((await repo.command('config get', [{ operand: 'test.value' }])).stdout).toBe(
        '--literal\n',
      );
      expect(
        (await repo.command('config set', [{ operand: 'test.value' }, { operand: '--' }])).exitCode,
      ).toBe(0);
      expect((await repo.command('config get', [{ operand: 'test.value' }])).stdout).toBe('--\n');
      expect(() => commandArguments('config get', [{ operand: 'test.value' }, ['--all']])).toThrow(
        GitArgumentError,
      );
      expect(() =>
        commandArguments('config set', [{ operand: 'test.value' }, ['--'], { operand: 'x' }]),
      ).toThrow(GitArgumentError);
      expect(
        (await repo.command('config rename-section', [{ operand: 'test' }, { operand: 'renamed' }]))
          .exitCode,
      ).toBe(0);
      expect((await repo.command('config unset', [{ operand: 'renamed.value' }])).exitCode).toBe(0);
      expect(
        (await repo.command('config set', [{ operand: 'renamed.value' }, { operand: '1' }]))
          .exitCode,
      ).toBe(0);
      expect((await repo.command('config remove-section', [{ operand: 'renamed' }])).exitCode).toBe(
        0,
      );
      expect((await repo.command('config list', [])).exitCode).toBe(0);
      expect((await repo.command('config edit', [])).exitCode).toBe(0);
    },
  );

  it.skipIf(legacy)('matches config type transitions and filter restrictions against Git', () => {
    for (const flags of [
      ['--type=int', '--int'],
      ['--type=int', '--type=bool'],
      ['--type=int', '--no-type', '--type=bool'],
      ['--type=wrong', '--type=int'],
      ['--fixed-value'],
      ['--default=1', '--all'],
      ['--url=https://example.com', '--regexp'],
      ['--local', '--global'],
    ]) {
      const args = [
        ...flags.map((flag) =>
          flag.includes('=')
            ? [flag.slice(0, flag.indexOf('=')), flag.slice(flag.indexOf('=') + 1)]
            : [flag],
        ),
        { operand: 'test.value' },
      ];
      const actual = direct(['-c', 'test.value=1', 'config', 'get', ...flags, 'test.value']);
      if (actual.status === 0) {
        expect(commandArguments('config get', args)).toEqual([
          'config',
          'get',
          ...flags,
          'test.value',
        ]);
      } else {
        expect(() => commandArguments('config get', args), flags.join(' ')).toThrow(
          GitArgumentError,
        );
      }
    }
    expect(() =>
      commandArguments('config set', [
        ['--append'],
        ['--value', ''],
        { operand: 'test.value' },
        { operand: '1' },
      ]),
    ).toThrow(GitArgumentError);
    expect(direct(['config', 'set', '--append', '--value=', 'test.value', '1']).status).not.toBe(0);
    expect(() => commandArguments('config edit', [['--file', '-']])).toThrow(GitArgumentError);
    expect(direct(['config', 'edit', '--file=-']).status).not.toBe(0);
  });

  it('keeps parent notes options before subcommands and allows concatenated message sources', async () => {
    expect(
      commandArguments('notes add', [
        ['--ref', 'custom'],
        ['-m', 'one'],
        ['-m', 'two'],
      ]),
    ).toEqual(['notes', '--ref=custom', 'add', '-m', 'one', '-m', 'two']);
    expect(
      (
        await repo.command('notes add', [
          ['--ref', 'custom'],
          ['-m', 'one'],
          ['-m', 'two'],
        ])
      ).exitCode,
    ).toBe(0);
    expect((await repo.command('notes show', [['--ref', 'custom']])).stdout).toBe('one\n\ntwo\n');
    expect(
      (
        await repo.command('notes append', [
          ['--ref', 'custom'],
          ['-m', 'three'],
        ])
      ).exitCode,
    ).toBe(0);
    expect(
      (
        await repo.command('notes edit', [
          ['--ref', 'custom'],
          ['-m', 'replacement'],
        ])
      ).exitCode,
    ).toBe(0);
    expect((await repo.command('notes list', [['--ref', 'custom']])).exitCode).toBe(0);
    expect((await repo.command('notes', [['--ref', 'custom']])).exitCode).toBe(0);
    expect((await repo.command('notes get-ref', [['--ref', 'custom']])).stdout).toBe(
      'refs/notes/custom\n',
    );
    await repo.commit({ message: 'second', allowEmpty: true });
    expect(
      (await repo.command('notes copy', [['--ref', 'custom'], { operand: 'HEAD~1' }])).exitCode,
    ).toBe(0);
    expect(
      (await repo.command('notes remove', [['--ref', 'custom'], { operand: 'HEAD' }])).exitCode,
    ).toBe(0);
    expect((await repo.command('notes prune', [['--ref', 'custom'], ['--dry-run']])).exitCode).toBe(
      0,
    );
    expect(
      (await repo.command('notes merge', [['--ref', 'merged'], { operand: 'custom' }])).exitCode,
    ).toBe(0);
    for (const flags of [
      ['--commit', '--abort'],
      ['--commit', '--strategy=ours'],
    ]) {
      const args = flags.map((flag) =>
        flag.includes('=')
          ? [flag.slice(0, flag.indexOf('=')), flag.slice(flag.indexOf('=') + 1)]
          : [flag],
      );
      expect(direct(['notes', 'merge', ...flags]).status).not.toBe(0);
      expect(() => commandArguments('notes merge', args)).toThrow(GitArgumentError);
    }
    expect(direct(['notes', 'copy', '--stdin', 'HEAD']).status).not.toBe(0);
    expect(() => commandArguments('notes copy', [['--stdin'], { operand: 'HEAD' }])).toThrow(
      GitArgumentError,
    );
  });

  it('treats every stash create argument as message text, including --help and --', async () => {
    await writeFile(join(repo.workdir, 'tracked'), 'initial\n');
    await repo.add('tracked');
    await repo.commit({ message: 'tracked' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
    const created = await repo.command('stash create', [
      { operand: '--help' },
      { operand: '--' },
      { operand: 'message' },
    ]);
    expect(created.exitCode).toBe(0);
    const message = direct(['show', '-s', '--format=%s', created.stdout.trim()]);
    expect(message.stdout).toContain('--help -- message');
    expect(() => commandArguments('stash create', [['--']])).toThrow(GitArgumentError);
  });
});
