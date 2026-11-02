import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import { validateInput, validateOptions } from '../core/option-rules.js';
import type { WorktreeRepo } from '../core/repo.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandArgument } from './types.js';

const EMPTY_PATHSPEC = 'empty string is not a valid pathspec';
const NO_PATHS = 'No paths with --include/--only does not make sense';
const EMPTY_PATHSPEC_RULE = /\.empty-pathspec\]/;
const ONLY_PATHS_RULE = /\.only-paths\]/;

type Case = readonly [args: readonly GitCommandArgument[], words: readonly string[]];

describe('status and commit path operands', () => {
  let root: string;
  let repo: WorktreeRepo;
  let env: Record<string, string>;
  let fileOption = false;
  let fixupPrefixes = false;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-status-commit-paths-'));
    env = {
      PATH: process.env.PATH ?? '',
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_COUNT: '0',
      LC_ALL: 'C',
      GIT_EDITOR: 'true',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    repo = await new TypeGit({ home: root, inheritEnv: false, env }).init(join(root, 'repo'));
    await writeFile(join(repo.workdir, 'tracked'), 'initial\n');
    await repo.add('tracked');
    await repo.commit({ message: 'tracked' });
    await writeFile(join(repo.workdir, 'tracked'), 'changed\n');
    await writeFile(join(repo.workdir, 'paths'), 'tracked\n');
    const help = direct('commit', ['-h']).stdout ?? '';
    // --pathspec-from-file arrived in Git 2.26 and amend:/reword: fixups in Git 2.32, so the
    // legacy Git 2.25.1 job checks only the cases that do not use them.
    fileOption = help.includes('--pathspec-from-file');
    fixupPrefixes = help.includes('amend|reword');
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });
  /** Run native Git directly; every compared case stops before writing a commit. */
  const direct = (command: string, args: readonly string[]) =>
    spawnSync('git', ['-C', repo.workdir, command, ...args], {
      env,
      input: '',
      encoding: 'utf8',
      timeout: 10000,
    });
  const expectRefusal = (command: 'status' | 'commit', cases: readonly Case[], text: string) => {
    for (const [args, words] of cases) {
      const label = JSON.stringify(words);
      const native = direct(command, words);
      expect(native.status, label).toBe(128);
      expect(native.stderr, label).toContain(text);
      expect(() => commandArguments(command, args), label).toThrow(GitArgumentError);
      // The refusal must come from the rule for this diagnostic, not an unrelated one.
      expect(() => commandArguments(command, args), label).toThrow(
        text === EMPTY_PATHSPEC ? EMPTY_PATHSPEC_RULE : ONLY_PATHS_RULE,
      );
    }
  };
  const expectNoRefusal = (command: 'status' | 'commit', cases: readonly Case[]) => {
    for (const [args, words] of cases) {
      const label = JSON.stringify(words);
      const native = direct(command, words);
      expect(native.stderr, label).not.toContain(EMPTY_PATHSPEC);
      expect(native.stderr, label).not.toContain(NO_PATHS);
      // Dry runs exit 1 when nothing is staged; any later fatal error would be unrelated.
      expect([0, 1], label).toContain(native.status);
      expect(commandArguments(command, args), label).toEqual([command, ...words]);
    }
  };

  it('refuses an empty status pathspec after option parsing, as native Git does', () => {
    expectRefusal(
      'status',
      [
        [[{ operand: '' }], ['']],
        [
          [['--'], { operand: '' }],
          ['--', ''],
        ],
        [
          [['--short'], { operand: 'tracked' }, { operand: '' }],
          ['--short', 'tracked', ''],
        ],
      ],
      EMPTY_PATHSPEC,
    );
    const help = direct('status', ['-h', '--', '']);
    // Usage exits 129 up to Git 2.55 and 0 from Git 2.56; either way it precedes the pathspec.
    expect([0, 129]).toContain(help.status);
    expect(help.stdout).toContain('usage: git status');
    expect(commandArguments('status', [['-h'], ['--'], { operand: '' }])).toEqual([
      'status',
      '-h',
      '--',
      '',
    ]);
  });

  it('refuses an empty commit pathspec in commit and dry-run modes', () => {
    const fileCases: Case[] = [
      // Git parses the operand before it reports the pathspec-file conflict.
      [
        [['--dry-run'], ['--pathspec-from-file', 'paths'], { operand: '' }],
        ['--dry-run', '--pathspec-from-file=paths', ''],
      ],
    ];
    expectRefusal(
      'commit',
      [
        [
          [['-m', 'message'], { operand: '' }],
          ['-m', 'message', ''],
        ],
        [
          [['--dry-run'], ['--'], { operand: 'tracked' }, { operand: '' }],
          ['--dry-run', '--', 'tracked', ''],
        ],
        [
          [['--short'], { operand: '' }],
          ['--short', ''],
        ],
        [
          [['-m', 'message'], ['--include'], { operand: '' }],
          ['-m', 'message', '--include', ''],
        ],
        [
          [['-m', 'message'], ['--only'], ['--amend'], { operand: '' }],
          ['-m', 'message', '--only', '--amend', ''],
        ],
        ...(fileOption ? fileCases : []),
      ],
      EMPTY_PATHSPEC,
    );
    expect(commandArguments('commit', [['--only'], { operand: '' }, ['-h']])).toEqual([
      'commit',
      '--only',
      '',
      '-h',
    ]);
    expect([0, 129]).toContain(direct('commit', ['--only', '', '-h']).status);
    const help = direct('commit', ['-h', '--', '']);
    expect([0, 129]).toContain(help.status);
    expect(help.stdout).toContain('usage: git commit');
  });

  it('refuses only mode without paths unless an empty commit is allowed', () => {
    expectRefusal(
      'commit',
      [
        [
          [['-m', 'message'], ['--only']],
          ['-m', 'message', '--only'],
        ],
        [
          [['--only'], ['--dry-run']],
          ['--only', '--dry-run'],
        ],
        [
          [['-o'], ['--dry-run']],
          ['-o', '--dry-run'],
        ],
        [
          [['--only'], ['--allow-empty'], ['--no-allow-empty'], ['--dry-run']],
          ['--only', '--allow-empty', '--no-allow-empty', '--dry-run'],
        ],
        [
          [['--only'], ['--amend'], ['--no-amend'], ['--dry-run']],
          ['--only', '--amend', '--no-amend', '--dry-run'],
        ],
        [
          [['--only'], ['--fixup', 'HEAD'], ['--dry-run']],
          ['--only', '--fixup=HEAD', '--dry-run'],
        ],
      ],
      NO_PATHS,
    );
    // Git 2.32+ refuses --amend with a plain fixup here, but older Git accepts it, so the
    // wrapper leaves that combination to native Git.
    const amendFixup = ['--only', '--amend', '--fixup=HEAD', '--dry-run'];
    expect(
      commandArguments('commit', [['--only'], ['--amend'], ['--fixup', 'HEAD'], ['--dry-run']]),
    ).toEqual(['commit', ...amendFixup]);
    const native = direct('commit', amendFixup);
    if (fixupPrefixes) {
      expect(native.stderr).toContain(NO_PATHS);
    } else {
      expect(native.stderr).not.toContain(NO_PATHS);
    }
    const fileCases: Case[] = [
      [
        [['--only'], ['--pathspec-from-file', 'paths'], ['--dry-run']],
        ['--only', '--pathspec-from-file=paths', '--dry-run'],
      ],
    ];
    const prefixCases: Case[] = [
      [
        [['--only'], ['--fixup', 'amend:HEAD'], ['--dry-run']],
        ['--only', '--fixup=amend:HEAD', '--dry-run'],
      ],
    ];
    expectNoRefusal('commit', [
      [
        [['--only'], ['--allow-empty'], ['--dry-run']],
        ['--only', '--allow-empty', '--dry-run'],
      ],
      [
        [['--only'], ['--amend'], ['--dry-run']],
        ['--only', '--amend', '--dry-run'],
      ],
      [
        [['--only'], ['--fixup', 'HEAD'], ['--allow-empty'], ['--dry-run']],
        ['--only', '--fixup=HEAD', '--allow-empty', '--dry-run'],
      ],
      [
        [['--only'], ['--amend'], ['--fixup', 'HEAD'], ['--no-fixup'], ['--dry-run']],
        ['--only', '--amend', '--fixup=HEAD', '--no-fixup', '--dry-run'],
      ],
      [
        [['--only'], { operand: 'tracked' }, ['--dry-run']],
        ['--only', 'tracked', '--dry-run'],
      ],
      ...(fileOption ? fileCases : []),
      ...(fixupPrefixes ? prefixCases : []),
    ]);
  });

  it('applies the same path requirements to repo.commit, which emits no paths', async () => {
    const refused = [
      { message: 'message', include: true },
      { message: 'message', include: true, pathspecFromFile: '' },
      { message: 'message', only: true },
      { message: 'message', only: true, fixup: '' },
      { only: true, fixup: 'HEAD' },
      // Reword fixups exclude content selection.
      { only: true, fixup: 'reword:HEAD' },
      { all: true, fixup: 'reword:HEAD' },
    ];
    for (const opts of refused) {
      expect(() => {
        validateOptions('commit', opts);
        validateInput('commitPaths', opts, 'commit');
      }, JSON.stringify(opts)).toThrow(GitArgumentError);
    }
    for (const opts of [
      { message: 'message', only: true, allowEmpty: true },
      { message: 'message', only: true, amend: true },
      { message: 'message', include: true, pathspecFromFile: 'paths' },
      { only: true, fixup: 'amend:HEAD' },
      // An empty fixup is not emitted, so --amend still exempts only mode.
      { only: true, amend: true, fixup: '' },
      // Older Git accepts amend with a plain fixup; Git 2.32+ refuses it natively.
      { only: true, amend: true, fixup: 'HEAD' },
    ]) {
      expect(() => {
        validateOptions('commit', opts);
        validateInput('commitPaths', opts, 'commit');
      }, JSON.stringify(opts)).not.toThrow();
    }
    // The executing Git refuses the emitted form of a rejected request.
    const native = direct('commit', ['-m', 'message', '--only']);
    expect(native.status).toBe(128);
    expect(native.stderr).toContain(NO_PATHS);
    await expect(repo.commit({ message: 'message', only: true })).rejects.toThrow(GitArgumentError);
    await expect(repo.commit({ message: 'message', include: true })).rejects.toThrow(
      GitArgumentError,
    );
  });
});
