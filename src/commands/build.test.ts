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

describe('typed command arguments', () => {
  it('preserves option order, aliases, repetition, empty values and operands', () => {
    expect(
      commandArguments('lfs checkout', [['--ours'], ['--ours', false], { operand: 'file' }]),
    ).toEqual(['lfs', 'checkout', '--ours', '--ours=false', 'file']);
    expect(
      commandArguments('lfs migrate info', [
        ['-I', ''],
        ['--include', '*.bin'],
        ['--include-ref', 'main'],
        ['--include-ref', 'topic'],
      ]),
    ).toEqual([
      'lfs',
      'migrate',
      'info',
      '-I',
      '',
      '--include=*.bin',
      '--include-ref=main',
      '--include-ref=topic',
    ]);
    expect(commandArguments('lfs track', [['--'], { operand: '--file' }])).toEqual([
      'lfs',
      'track',
      '--',
      '--file',
    ]);
  });

  it('checks unknown commands/options and value shapes for JavaScript callers', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'not-a-command']) {
      expect(() => commandArguments(name as GitCommandName, [])).toThrow(GitArgumentError);
    }
    for (const args of [
      [['--unknown']],
      [['--file']],
      [['--file', 1]],
      [null],
      [['--', 'extra']],
      [{ operand: '--check' }],
      [['--'], ['--check']],
      [['--file', 'a\0b']],
    ]) {
      expect(() => commandArguments('lfs pointer', args)).toThrow(GitArgumentError);
    }
    expect(() => commandArguments('lfs locks', [['--limit', 1.5]])).toThrow(GitArgumentError);
  });

  it('checks effective values and supports help before semantic validation', () => {
    expect(() => commandArguments('lfs checkout', [['--ours'], ['--to', 'out']])).toThrow(
      'exactly one',
    );
    expect(() =>
      commandArguments('lfs checkout', [
        ['--ours'],
        ['--theirs'],
        ['--to', 'out'],
        { operand: 'file' },
      ]),
    ).toThrow('stage');
    expect(commandArguments('lfs checkout', [['--ours'], ['--theirs'], ['--help']])).toContain(
      '--help',
    );
    expect(() => commandArguments('lfs checkout', [['--ours'], ['--help', false]])).toThrow(
      'destination',
    );
    expect(() => commandArguments('lfs install', [['--force'], ['--manual']], true)).toThrow(
      'Hook installation',
    );
    expect(
      commandArguments('lfs install', [['--force'], ['--manual'], ['--skip-repo']], true),
    ).toContain('--skip-repo');
  });
});

describe('typed commands against Git LFS', () => {
  let root: string;
  let git: TypeGit;
  let repo: WorktreeRepo;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-cli-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      GIT_TERMINAL_PROMPT: '0',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    await writeFile(join(root, 'config'), '');
    git = new TypeGit({ home: root, inheritEnv: false, env });
    repo = await git.init(join(root, 'repo'));
    await repo.commit({ message: 'initial', allowEmpty: true });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('executes help safely for every registered scope and matches independent CLI output', async () => {
    for (const name of Object.keys(COMMAND_SPECS) as GitCommandName[]) {
      if (!name.startsWith('lfs')) {
        continue;
      }
      const direct = spawnSync('git', ['-C', repo.workdir, ...name.split(' '), '--help'], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(direct.error, name).toBeUndefined();
      const actual = await repo.command(name, [['--help']]);
      expect(actual.exitCode, name).toBe(direct.status);
      expect(actual.stdout, name).toBe(direct.stdout);
    }
  }, 30000);

  it('matches native hash-object for every finite combination of its independent constraints', async () => {
    const file = join(root, 'hash-input');
    await writeFile(file, 'hello');
    for (const stdinCount of [0, 1, 2]) {
      for (const stdinPaths of [false, true]) {
        for (const noFilters of [false, true]) {
          for (const path of [undefined, '', 'file']) {
            for (const files of [false, true]) {
              const args: unknown[] = Array.from({ length: stdinCount }, () => ['--stdin']);
              const argv = Array.from({ length: stdinCount }, () => '--stdin');
              if (stdinPaths) {
                args.push(['--stdin-paths']);
                argv.push('--stdin-paths');
              }
              if (noFilters) {
                args.push(['--no-filters']);
                argv.push('--no-filters');
              }
              if (path !== undefined) {
                args.push(['--path', path]);
                argv.push(`--path=${path}`);
              }
              if (files) {
                args.push({ operand: file });
                argv.push(file);
              }
              const direct = spawnSync('git', ['-C', repo.workdir, 'hash-object', ...argv], {
                env,
                input: '',
                encoding: 'utf8',
                timeout: 10000,
              });
              expect(direct.error, JSON.stringify(args)).toBeUndefined();
              if (direct.status === 0) {
                expect(commandArguments('hash-object', args)).toEqual(['hash-object', ...argv]);
              } else {
                expect(() => commandArguments('hash-object', args), JSON.stringify(args)).toThrow(
                  GitArgumentError,
                );
              }
            }
          }
        }
      }
    }
    for (const args of [
      [['--stdin'], ['--no-stdin'], ['--stdin']],
      [['--no-filters'], ['--filters'], ['--path', 'file']],
      [['--no-filters'], ['--no-no-filters'], ['--path', 'file']],
      [['--path', 'file'], ['--no-path'], ['--no-filters']],
    ]) {
      const argv = commandArguments('hash-object', args);
      const direct = spawnSync('git', ['-C', repo.workdir, ...argv], {
        env,
        input: 'hello',
        encoding: 'utf8',
      });
      expect(direct.status, JSON.stringify(args)).toBe(0);
    }
    const actual = await git.command('hash-object', [['--stdin']], { stdin: 'hello' });
    expect(actual.stdout.trim()).toBe('b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
  });

  it('preserves remote parent options and checks modes against an isolated repository', async () => {
    const name = 'remote add';
    const target = [{ operand: 'origin' }, { operand: '.' }];
    const invalid = [
      [['--mirror', 'push'], ['--track', ''], ...target],
      [['--mirror', 'push'], ['--master', 'main'], ...target],
      [['--mirror', 'invalid'], ...target],
      [{ operand: 'origin' }],
    ];
    for (const args of invalid) {
      const argv = args.flatMap((arg) =>
        Array.isArray(arg) ? (arg.length === 1 ? arg : [`${arg[0]}=${arg[1]}`]) : [arg.operand],
      );
      const direct = spawnSync('git', ['-C', repo.workdir, 'remote', 'add', ...argv], {
        env,
        encoding: 'utf8',
      });
      expect(direct.status).not.toBe(0);
      expect(() => commandArguments(name, args)).toThrow(GitArgumentError);
    }
    expect(
      commandArguments('remote show', [['-v'], ['-n'], ['--verbose'], { operand: 'origin' }]),
    ).toEqual(['remote', '-v', '--verbose', 'show', '-n', 'origin']);
    expect((await repo.command('remote add', target)).exitCode).toBe(0);
    const actual = await repo.command('remote show', [['-v'], ['-n'], { operand: 'origin' }]);
    const direct = spawnSync('git', ['-C', repo.workdir, 'remote', '-v', 'show', '-n', 'origin'], {
      env,
      encoding: 'utf8',
    });
    expect(actual.stdout).toBe(direct.stdout);
    expect(
      (await repo.command('remote set-url', [{ operand: 'origin' }, { operand: '..' }])).exitCode,
    ).toBe(0);
    expect((await repo.command('remote get-url', [{ operand: 'origin' }])).stdout.trim()).toBe(
      '..',
    );
    expect((await repo.command('remote remove', [{ operand: 'origin' }])).exitCode).toBe(0);
  });

  it('checks basic command combinations and honors flags that Git ignores in interactive mode', () => {
    const cases: [GitCommandName, unknown[], string[]][] = [
      ['add', [['--all'], ['--update']], ['--all', '--update']],
      ['add', [['--ignore-missing']], ['--ignore-missing']],
      ['add', [['--chmod', 'invalid']], ['--chmod=invalid']],
      ['add', [['--dry-run'], ['--interactive']], ['--dry-run', '--interactive']],
      ['add', [['--no-auto-advance']], ['--no-auto-advance']],
      ['rm', [], []],
      ['mv', [{ operand: 'old' }], ['old']],
      ['clean', [['--dry-run'], ['-x'], ['-X']], ['--dry-run', '-x', '-X']],
      [
        'init',
        [['--bare'], ['--separate-git-dir', 'other']],
        ['--bare', '--separate-git-dir=other'],
      ],
    ];
    for (const [name, args, argv] of cases) {
      if (
        process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true' &&
        name === 'add' &&
        argv.includes('--interactive')
      ) {
        continue;
      }
      const direct = spawnSync('git', ['-C', repo.workdir, name, ...argv], {
        env,
        input: '',
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(direct.error).toBeUndefined();
      expect(direct.status, name).not.toBe(0);
      expect(() => commandArguments(name, args), name).toThrow(GitArgumentError);
    }
    for (const args of [
      [['--all'], ['--ignore-removal'], ['--update']],
      [['--unified', -1]],
      [['--interactive'], ['--chmod', 'ignored']],
    ]) {
      if (
        process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true' &&
        args.some((arg) => arg[0] === '--unified')
      ) {
        continue;
      }
      const argv = commandArguments('add', args);
      const direct = spawnSync('git', ['-C', repo.workdir, ...argv], {
        env,
        input: 'q\n',
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(direct.status, JSON.stringify(args)).toBe(0);
    }
  });

  it('writes stdin and exposes predictable pointer results through global and repository clients', async () => {
    const file = join(root, 'file.bin');
    await writeFile(file, 'hello');
    const pointer = await git.command('lfs pointer', [['--file', file], ['--no-extensions']]);
    expect(pointer.exitCode).toBe(0);
    expect(pointer.stdout).toContain('version https://git-lfs.github.com/spec/v1');
    const checked = await repo.command('lfs pointer', [['--check'], ['--stdin']], {
      stdin: pointer.stdout,
    });
    expect(checked.exitCode).toBe(0);
    const invalid = await repo.command('lfs pointer', [['--check'], ['--stdin']], {
      stdin: 'invalid pointer',
    });
    expect(invalid.exitCode).toBe(1);
    const bare = await git.init(join(root, 'bare'), { bare: true });
    expect((await bare.command('lfs version', [])).stdout).toContain('git-lfs/');
  });

  it('allows ignored strict flags outside checking mode and effective false flags', async () => {
    const file = join(root, 'file.bin');
    await writeFile(file, 'hello');
    expect(
      (await git.command('lfs pointer', [['--file', file], ['--strict'], ['--no-strict']]))
        .exitCode,
    ).toBe(0);
    expect((await repo.command('lfs checkout', [['--ours'], ['--ours', false]])).exitCode).toBe(0);
    await expect(repo.command('lfs checkout', [['--ours']] as never)).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});
