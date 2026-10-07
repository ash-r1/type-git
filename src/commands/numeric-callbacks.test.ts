import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGit } from '../adapters/node/index.js';
import type { GitScalarParser } from '../constraints/git-scalars.js';
import { parseGitScalar } from '../constraints/git-scalars.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import type { CommandSpec } from './spec.js';
import type { GitCommandName } from './types.js';

const registry = JSON.parse(
  readFileSync(new URL('../../spec/git-numeric-callbacks.json', import.meta.url), 'utf8'),
) as { profiles: Record<string, { parser: GitScalarParser }> };
const samples = [
  '',
  ' ',
  '+',
  '-',
  '0',
  '-0',
  '+001',
  '010',
  '08',
  '\t2',
  '1 ',
  '1\n',
  '0x10',
  '0b10',
  '1k',
  '1.5',
  '1e2',
  '-1',
  '2147483647',
  '2147483648',
  '-2147483648',
  '-2147483649',
  '4294967295',
  '4294967296',
  '4294967297',
  '-4294967295',
  '9223372036854775807',
  '9223372036854775808',
  '-9223372036854775808',
  '-9223372036854775809',
];

describe('source-audited numeric callback stages', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'type-git-numeric-cb-'));
    env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      LC_ALL: 'C',
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    };
    expect(spawnSync('git', ['init', root], { env }).status).toBe(0);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('compares decimal syntax, C narrowing and overflow against independent Git', () => {
    const profiles = [
      { command: 'describe', flag: '--abbrev', profile: 'abbrev', tail: ['-h'] },
      { command: 'cherry-pick', flag: '--mainline', profile: 'mainline', tail: ['-h'] },
      { command: 'grep', flag: '--context', profile: 'grep-context', tail: ['-e', 'needle'] },
      { command: 'diff-files', flag: '--unified', profile: 'unified-context', tail: [] },
      { command: 'rev-list', flag: '--max-count', profile: 'revision-count', tail: ['--all'] },
      { command: 'apply', flag: '-p', profile: 'strip-count', tail: ['-h'] },
    ] as const;
    for (const profile of profiles) {
      for (const value of samples) {
        const native = spawnSync(
          'git',
          [
            '-C',
            root,
            profile.command,
            ...(profile.flag.startsWith('--')
              ? [`${profile.flag}=${value}`]
              : [profile.flag, value]),
            ...profile.tail,
          ],
          { env, encoding: 'utf8', timeout: 5000 },
        );
        expect(native.error).toBeUndefined();
        const invalid = /expects|not an integer/.test(native.stderr);
        if (!invalid) {
          expect(profile.command === 'grep' ? [1] : [0, 129], native.stderr).toContain(
            native.status,
          );
        }
        const parser = registry.profiles[profile.profile]!.parser;
        expect(
          parseGitScalar(parser, value).valid,
          `${profile.command} ${JSON.stringify(value)}: ${native.stderr}`,
        ).toBe(!invalid);
        const args = [
          [profile.flag, value],
          ...(profile.command === 'grep' ? [['-e', 'needle']] : profile.tail.map((flag) => [flag])),
        ];
        if (invalid) {
          expect(() => commandArguments(profile.command, args, true)).toThrow(GitArgumentError);
        } else {
          expect(() => commandArguments(profile.command, args, true)).not.toThrow();
        }
      }
    }
  }, 30000);

  it('normalizes values before final combination checks and serializes empty optional short values', () => {
    for (const value of ['0', '4294967296', '-9223372036854775809']) {
      const native = spawnSync('git', ['-C', root, 'describe', '--long', `--abbrev=${value}`], {
        env,
        encoding: 'utf8',
      });
      expect(native.stderr).toContain("options '--long' and '--abbrev=0' cannot be used together");
      expect(() => commandArguments('describe', [['--long'], ['--abbrev', value]], true)).toThrow(
        GitArgumentError,
      );
    }
    expect(commandArguments('diff-files', [['-U', '']], true)).toEqual([
      'diff-files',
      '--unified=',
    ]);
    expect(
      commandArguments(
        'grep',
        [
          ['--context', '-1'],
          ['-e', 'needle'],
        ],
        true,
      ),
    ).toContain('--context=-1');
    expect(commandArguments('grep', [['-9223372036854775808'], ['-e', 'needle']], true)).toContain(
      '-9223372036854775808',
    );
    expect(() => commandArguments('describe', [['--abbrev', true], ['-h']], true)).toThrow(
      GitArgumentError,
    );
    expect(() => commandArguments('grep', [['-1\n'], ['-h']], true)).toThrow(GitArgumentError);
    expect(parseGitScalar(registry.profiles['unified-context']!.parser, true, 17).value).toBe(17);
    expect(parseGitScalar(registry.profiles['grep-context']!.parser, '-1').value).toBe(4294967295);
    expect(parseGitScalar(registry.profiles.mainline!.parser, '-4294967295').value).toBe(1);
    expect(parseGitScalar(registry.profiles.abbrev!.parser, '9223372036854775808').value).toBe(4);
  });

  it('checks numeric callback values immediately in every generated scope', () => {
    let total = 0;
    for (const [command, spec] of Object.entries(COMMAND_SPECS) as [
      GitCommandName,
      CommandSpec,
    ][]) {
      for (const [flag, option] of Object.entries(spec.options)) {
        if (
          typeof option.parser !== 'object' ||
          option.parser.kind !== 'decimal' ||
          option.value === 'flag'
        ) {
          continue;
        }
        total++;
        expect(
          () => commandArguments(command, [[flag, '1k'], [flag, 1], ['-h']], true),
          `${command} ${flag}`,
        ).toThrow('invalid integer');
      }
    }
    expect(total).toBeGreaterThan(100);
  });
  it('shares mainline conversion with convenience methods and preserves empty diff context', async () => {
    const directory = await mkdtemp(join(root, 'work-'));
    const run = (...args: string[]): string => {
      const result = spawnSync('git', ['-C', directory, ...args], { env, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      return result.stdout.trimEnd();
    };
    run('init');
    await writeFile(join(directory, 'file'), 'one\ntwo\nthree\n');
    run('add', 'file');
    run('commit', '-m', 'base');
    await writeFile(join(directory, 'file'), 'one\nchanged\nthree\n');
    const argv = commandArguments('diff-files', [['-U', '']], true);
    expect(run(...argv)).toBe(run('diff-files', '--unified='));
    expect(run(...argv)).not.toContain('\n one\n');
    run('add', 'file');
    run('commit', '-m', 'delta');
    const delta = run('rev-parse', 'HEAD');
    run('reset', '--hard', 'HEAD^');
    const git = new TypeGit({ home: root, inheritEnv: false, env });
    const repo = await git.open(directory);
    await repo.cherryPick(delta, { noCommit: true, mainline: -4294967295 });
    expect(run('diff', '--cached', '--name-only')).toBe('file');
    run('reset', '--hard', delta);
    await repo.revert('HEAD', { noCommit: true, mainline: -4294967295 });
    expect(run('diff', '--cached', '--name-only')).toBe('file');
    await expect(repo.cherryPick(delta, { mainline: 2147483648 })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
    await expect(repo.revert('HEAD', { mainline: 2147483648 })).rejects.toBeInstanceOf(
      GitArgumentError,
    );
  });
});
