import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/reference-parser-corpus.json';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('native reference and status parsers', () => {
  it('matches the independent native corpus and preserves serialized argv', () => {
    const mismatches: string[] = [];
    for (const row of corpus.cases) {
      let accepted = false;
      try {
        const argv = commandArguments(row.command as GitCommandName, row.tokens, true);
        expect(argv).toEqual(row.argv);
        accepted = true;
      } catch (error) {
        if (!(error instanceof GitArgumentError)) {
          throw error;
        }
      }
      if (accepted !== row.valid) {
        mismatches.push(
          `${JSON.stringify(row.argv)}: native=${row.valid}, wrapper=${accepted}, ${row.diagnostic}`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
  it('uses LASTARG_DEFAULT only when no following word exists', () => {
    expect(initialParserPass(COMMAND_SPECS.branch, ['--contains', '-h', '--color=bad'])).toEqual({
      exited: false,
      tokens: [
        ['--contains', '-h'],
        ['--color', 'bad'],
      ],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS.branch, ['--contains'])).toEqual({
      exited: false,
      tokens: [['--contains']],
      remaining: [],
    });
    expect(initialParserPass(COMMAND_SPECS.branch, ['--track', '-h'])).toEqual({
      exited: true,
      tokens: [['--track'], ['-h']],
      remaining: [],
    });
  });
});

describe('selected-native final untracked modes', () => {
  it('preserves native availability, final status and preemptive help across versions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-untracked-source-'));
    try {
      const env = {
        PATH: process.env.PATH ?? '',
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_COUNT: '0',
        LC_ALL: 'C',
      };
      const repo = await new TypeGit({ inheritEnv: false, env }).init(join(root, 'repo'));
      const cases: string[][] = [];
      for (const value of ['-2147483648', '0x10', 'all']) {
        cases.push(
          [`--untracked-files=${value}`],
          ['--ignored=matching', `--untracked-files=${value}`],
          [`--untracked-files=${value}`, '-h'],
        );
      }
      cases.push(
        ['--untracked-files=k', '-h'],
        ['--untracked-files=k', '--untracked-files=normal'],
      );
      for (const words of cases) {
        const native = spawnSync('git', ['status', ...words], {
          cwd: join(root, 'repo'),
          env,
          input: '',
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(native.error, JSON.stringify(words)).toBeUndefined();
        expect(native.signal).toBeNull();
        const tokens = words.map((word) =>
          word.startsWith('--')
            ? [word.slice(0, word.indexOf('=')), word.slice(word.indexOf('=') + 1)]
            : [word],
        );
        const actual = await repo.command('status', tokens as never);
        expect(actual.exitCode, JSON.stringify(words)).toBe(native.status);
        expect(actual.stdout).toBe(native.stdout);
        expect(actual.stderr).toBe(native.stderr);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
