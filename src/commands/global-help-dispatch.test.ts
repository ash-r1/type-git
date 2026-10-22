import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { GitCommandName } from './types.js';

const primaryCommands = (
  Object.entries(COMMAND_SPECS) as [GitCommandName, (typeof COMMAND_SPECS)[GitCommandName]][]
)
  .filter(([, spec]) => spec.argv.length === 1 && !('executable' in spec))
  .map(([command]) => command);

describe('global first-word documentation dispatch', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-primary-help-'));
    const viewer = join(root, 'viewer.cjs');
    await writeFile(viewer, "process.stdout.write('native-doc-viewer\\n');process.exit(0);\n");
    env = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')),
      ),
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'global'),
      LC_ALL: 'C',
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      NODE_OPTIONS: `--require "${viewer.replaceAll('\\', '/')}"`,
    };
    await writeFile(join(root, 'global'), '');
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    for (const [key, value] of [
      ['help.format', 'man'],
      ['man.viewer', 'man'],
      ['man.man.path', process.execPath],
    ]) {
      const configured = spawnSync('git', ['-C', repo.workdir, 'config', key, value], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(configured.error).toBeUndefined();
      expect(configured.signal).toBeNull();
      expect(configured.status, configured.stderr).toBe(0);
    }
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each(
    primaryCommands,
  )('matches the selected Git documentation parser for %s', async (command) => {
    for (const selector of ['--man', '-m', '-h', '--help-all']) {
      const words = [...COMMAND_SPECS[command].argv, '--help', selector];
      const native = spawnSync('git', ['-C', repo.workdir, ...words], {
        env,
        encoding: 'utf8',
        input: '',
        timeout: 10000,
      });
      const label = words.join(' ');
      expect(native.error, label).toBeUndefined();
      expect(native.signal, label).toBeNull();
      expect([0, 1, 129], label).toContain(native.status);
      if (native.status === 0) {
        expect(native.stdout, label).toContain(
          selector === '--man' || selector === '-m' ? 'native-doc-viewer' : 'usage: git help',
        );
      } else {
        // Missing documentation/frontends and usage failures remain actual native failures.
        expect(native.stdout + native.stderr, label).not.toBe('');
      }
      const args = [['--help'], [selector]];
      // Runtime corpus inputs are checked separately from the literal compiler contracts.
      const actual = await repo.command(command, args as never);
      expect(actual.exitCode, label).toBe(native.status);
      expect(actual.stdout, label).toBe(native.stdout);
      expect(actual.stderr, label).toBe(native.stderr);
      expect(commandArguments(command, args), label).toEqual(words);
    }
  }, 120_000);

  it('rejects refs child options before the documentation parser exits', async () => {
    const native = spawnSync('git', ['-C', repo.workdir, 'refs', '--help', 'list', '--count=bad'], {
      env,
      encoding: 'utf8',
      input: '',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect(native.status).toBe(129);
    expect(native.stderr).toContain('unknown option');
    expect(native.stderr).toContain('count=bad');
    const args = [['--help'], { operand: 'list' }, ['--count', 'bad']];
    expect(() => commandArguments('refs', args)).toThrow('unknown option --count');
    await expect(repo.command('refs', args as never)).rejects.toThrow(GitArgumentError);
  });

  it.each([
    ['commit', [['--help'], ['-h'], ['--unknown']], ['--help', '-h', '--unknown']],
    [
      'commit',
      [['--help'], ['--help-all'], ['--unknown', 'value']],
      ['--help', '--help-all', '--unknown', 'value'],
    ],
    ['remote', [['--help'], ['-h'], ['--track', 'topic']], ['--help', '-h', '--track', 'topic']],
    ['log', [['--help'], ['-h'], ['-3']], ['--help', '-h', '-3']],
    [
      'refs',
      [['--help'], ['-h'], { operand: 'list' }, ['--count', 'bad']],
      ['--help', '-h', 'list', '--count=bad'],
    ],
    ['switch', [['--help'], ['-h'], ['--conflict', 'bad']], ['--help', '-h', '--conflict=bad']],
    [
      'switch',
      [['--help'], ['--help'], ['--conflict', 'bad']],
      ['--help', '--help', '--conflict=bad'],
    ],
    ['commit', [['--help'], ['-h'], ['-m', 'message']], ['--help', '-h', '-m', 'message']],
    [
      'commit',
      [['--help'], ['--help-all'], ['-m', 'message']],
      ['--help', '--help-all', '-m', 'message'],
    ],
    ['branch', [['--help'], ['-h'], ['--color', 'invalid']], ['--help', '-h', '--color=invalid']],
    ['commit', [['--help'], ['--'], ['-m', 'message']], ['--help', '--', '-m', 'message']],
    [
      'commit',
      [['--help'], { operand: '-h' }, ['-m', 'message']],
      ['--help', '-h', '-m', 'message'],
    ],
  ] as const)('preserves ignored local shapes after documentation parsing ends for %s', async (command, args, words) => {
    const native = spawnSync('git', ['-C', repo.workdir, command, ...words], {
      env,
      encoding: 'utf8',
      input: '',
      timeout: 10000,
    });
    expect(native.error).toBeUndefined();
    expect(native.signal).toBeNull();
    expect([0, 129]).toContain(native.status);
    expect(native.stdout + native.stderr).toContain(
      words.some((word) => word === '--') ? 'native-doc-viewer' : 'usage: git help',
    );
    const actual = await repo.command(command, args as never);
    expect(actual.exitCode).toBe(native.status);
    expect(actual.stdout).toBe(native.stdout);
    expect(actual.stderr).toBe(native.stderr);
    expect(commandArguments(command, args)).toEqual([command, ...words]);
  });

  it('keeps local value shapes, child grammars and companion programs separate', () => {
    expect(commandArguments('commit', [['-m', 'message']])).toEqual(['commit', '-m', 'message']);
    for (const [command, args] of [
      ['commit', [['-m']]],
      ['commit', [['--help'], ['-m', 'message']]],
      ['commit', [['--help'], ['--allow-empty']]],
      ['add', [['--man']]],
      ['remote add', [['--help'], ['--man']]],
      ['scalar', [['--help'], ['--man']]],
      ['gitk', [['--help'], ['--man']]],
      ['add', [['--help'], ['--unknown']]],
      ['add', [['--help'], { operand: 'a\0b' }]],
    ] as const) {
      expect(() => commandArguments(command, args)).toThrow(GitArgumentError);
    }
  });
});
