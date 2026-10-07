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
describe('native fallback and first-word dispatch', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  const direct = (args: string[]) =>
    spawnSync('git', ['-C', repo.workdir, ...args], { env, encoding: 'utf8', timeout: 10000 });
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-fallback-'));
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
      GIT_EDITOR: 'true',
      GIT_PAGER: 'cat',
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'one\n');
    await repo.add('.');
    await repo.commit({ message: 'initial' });
    expect(direct(['config', 'test.value', 'one']).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const compare = (
    command: GitCommandName,
    args: readonly unknown[],
    argv: string[],
    valid: boolean,
  ) => {
    const result = direct([command, ...argv]);
    const label = `${command} ${argv.join(' ')}: ${result.stderr}`;
    expect(result.error, label).toBeUndefined();
    expect(result.signal, label).toBe(null);
    expect(result.status === 0, label).toBe(valid);
    const build = () => commandArguments(command, args, true);
    if (valid) {
      expect(build()).toEqual([command, ...argv]);
    } else {
      expect(build, label).toThrow(GitArgumentError);
    }
  };
  it('preserves implicit config actions and legacy selector arities', () => {
    compare('config', [{ operand: 'test.value' }], ['test.value'], true);
    compare('config', [], [], false);
    compare('config', [['--list']], ['--list'], true);
    compare('config', [['--list'], { operand: 'test.value' }], ['--list', 'test.value'], false);
    compare(
      'config',
      [['--get'], ['--get-all'], { operand: 'test.value' }],
      ['--get', '--get-all', 'test.value'],
      false,
    );
    compare(
      'config',
      [['--get'], ['--get'], { operand: 'test.value' }],
      ['--get', '--get', 'test.value'],
      true,
    );
    if (!legacy) {
      compare(
        'config',
        [['--no-get'], { operand: 'test.value' }],
        ['--no-get', 'test.value'],
        false,
      );
    }
    if (!legacy) {
      compare(
        'config',
        [['--edit'], { operand: 'ignored' }, { operand: 'tail' }],
        ['--edit', 'ignored', 'tail'],
        true,
      );
    }
    compare(
      'config',
      [['--name-only'], { operand: 'test.value' }],
      ['--name-only', 'test.value'],
      false,
    );
    compare(
      'config',
      [['--default', ''], ['--get-all'], { operand: 'test.value' }],
      ['--default=', '--get-all', 'test.value'],
      false,
    );
    compare(
      'config',
      [['--show-origin'], { operand: 'test.value' }, { operand: 'one' }],
      ['--show-origin', 'test.value', 'one'],
      false,
    );
    compare(
      'config',
      [['--get-color'], ['--type', 'color'], { operand: 'test.value' }],
      ['--get-color', '--type=color', 'test.value'],
      false,
    );
  });
  it.skipIf(legacy)('checks legacy value patterns and write-only comments', () => {
    compare(
      'config',
      [['--fixed-value'], ['--get'], { operand: 'test.value' }],
      ['--fixed-value', '--get', 'test.value'],
      false,
    );
    compare(
      'config',
      [['--fixed-value'], ['--get'], { operand: 'test.value' }, { operand: 'one' }],
      ['--fixed-value', '--get', 'test.value', 'one'],
      true,
    );
    compare(
      'config',
      [['--comment', ''], ['--get'], { operand: 'test.value' }],
      ['--comment=', '--get', 'test.value'],
      false,
    );
    compare(
      'config',
      [['--comment', 'note'], { operand: 'test.value' }, { operand: 'one' }],
      ['--comment=note', 'test.value', 'one'],
      true,
    );
    compare(
      'config',
      [['--file', '-'], ['--add'], { operand: 'test.value' }, { operand: 'one' }],
      ['--file=-', '--add', 'test.value', 'one'],
      false,
    );
  });
  it.skipIf(legacy)('dispatches modern config before applying any legacy callbacks', async () => {
    compare(
      'config',
      [{ operand: 'get' }, ['--all'], { operand: 'test.value' }],
      ['get', '--all', 'test.value'],
      true,
    );
    compare(
      'config',
      [{ operand: 'get' }, ['--all'], ['--default', 'one'], { operand: 'test.value' }],
      ['get', '--all', '--default=one', 'test.value'],
      false,
    );
    compare('config', [{ operand: 'edit' }, { operand: 'ignored' }], ['edit', 'ignored'], false);
    const result = await repo.command('config', [
      { operand: 'get' },
      ['--all'],
      { operand: 'test.value' },
    ]);
    expect(result.stdout.trim()).toBe('one');
    // A preceding legacy option stops root dispatch even when the next word names a subcommand.
    expect(commandArguments('config', [['--get'], { operand: 'get' }], true)).toEqual([
      'config',
      '--get',
      'get',
    ]);
  });
  it('keeps implicit stash paths distinct from explicit push and dispatches list', () => {
    compare('stash', [], [], true);
    compare('stash', [{ operand: 'tracked' }], ['tracked'], false);
    compare('stash', [['--'], { operand: 'tracked' }], ['--', 'tracked'], true);
    compare('stash', [{ operand: 'push' }, { operand: 'tracked' }], ['push', 'tracked'], true);
    compare(
      'stash',
      [{ operand: 'list' }, { operand: '--format=%gd' }],
      ['list', '--format=%gd'],
      true,
    );
    compare(
      'stash',
      [['--patch'], ['--include-untracked']],
      ['--patch', '--include-untracked'],
      false,
    );
    compare(
      'stash',
      [{ operand: 'push' }, ['--patch'], ['--include-untracked']],
      ['push', '--patch', '--include-untracked'],
      false,
    );
  });
  it('uses reflog show as the fallback while preserving child-specific constraints', () => {
    compare('reflog', [['--format', '%gd'], { operand: 'HEAD' }], ['--format=%gd', 'HEAD'], true);
    compare('reflog', [{ operand: 'show' }, ['--format', '%gd']], ['show', '--format=%gd'], true);
    if (!legacy) {
      compare(
        'reflog',
        [{ operand: 'exists' }, { operand: 'HEAD' }, { operand: 'extra' }],
        ['exists', 'HEAD', 'extra'],
        true,
      );
    }
    compare('reflog', [{ operand: 'exists' }], ['exists'], false);
    compare('reflog', [['--reverse']], ['--reverse'], false);
    compare('reflog', [{ operand: 'show' }, ['--reverse']], ['show', '--reverse'], false);
  });
});
