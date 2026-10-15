import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/conditional-stash-corpus.json';
import { TypeGit } from '../adapters/node/index.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { conditionalCommandPaths } from './conditional-command.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('conditional stash-list delegation', () => {
  const spec = COMMAND_SPECS['stash list'];
  it('accepts either feasible repository branch while preserving original argv', () => {
    for (const row of corpus.cases) {
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.accepted) {
        expect(build(), JSON.stringify(row.argv)).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row.argv)).toThrow(GitArgumentError);
      }
    }
  });
  it('matches both branch plans to independently traced native child invocations', () => {
    for (const row of corpus.cases) {
      if (!row.accepted) {
        continue;
      }
      const pass = initialParserPass(spec, row.argv.slice(2));
      if (pass.exited) {
        expect(row.outcomes.every((outcome) => outcome.valid && outcome.childArgv === null)).toBe(
          true,
        );
        continue;
      }
      const paths = conditionalCommandPaths(spec.conditionalCommand, pass.remaining);
      expect(paths.map((path) => path.exists)).toEqual([false, true]);
      for (const outcome of row.outcomes) {
        const selected = conditionalCommandPaths(
          spec.conditionalCommand,
          pass.remaining,
          outcome.refExists,
        );
        expect(selected).toEqual(
          paths.filter((candidate) => candidate.exists === outcome.refExists),
        );
        const path = selected[0]!;
        if (path.kind === 'return') {
          expect(outcome.childArgv).toBeNull();
          expect(outcome.status).toBe(path.exitCode);
        } else {
          expect([path.command, ...path.argv], JSON.stringify(row.argv)).toEqual(outcome.childArgv);
          expect(path.exitStatus).toBe('boolean');
          expect(outcome.status).toBe(Number(outcome.childStatus !== 0));
        }
      }
    }
  });
  it('still validates representation and the unconditional empty parser', () => {
    expect(() => commandArguments('stash list', [['-h'], ['--color', 'a\0b']])).toThrow(
      GitArgumentError,
    );
    expect(() => commandArguments('stash list', [{ operand: '-no-color' }])).toThrow(
      GitArgumentError,
    );
    expect(commandArguments('stash list', [['-h'], { operand: '-no-color' }])).toEqual([
      'stash',
      'list',
      '-h',
      '-no-color',
    ]);
    expect(() => commandArguments('stash list', [['--max-count', {}]])).toThrow(GitArgumentError);
  });
  it('lets Git select the actual branch at invocation time through the public API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-stash-api-'));
    try {
      const env = {
        PATH: process.env.PATH ?? '',
        HOME: root,
        XDG_CONFIG_HOME: root,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.test',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.test',
        LC_ALL: 'C',
        GIT_CONFIG_COUNT: '0',
      };
      const git = new TypeGit({ inheritEnv: false, env });
      const repo = await git.init(join(root, 'repo'));
      /** Observe the selected native parent's status without assuming its normalization profile. */
      const direct = (argv: readonly string[]) => {
        const native = spawnSync('git', ['-C', repo.workdir, ...argv], {
          env,
          input: '',
          encoding: 'utf8',
          timeout: 10000,
        });
        expect(native.error).toBeUndefined();
        expect(native.signal).toBe(null);
        expect(native.status).not.toBe(null);
        return native;
      };
      await writeFile(join(repo.workdir, 'file'), 'one\n');
      await repo.add('file');
      await repo.commit({ message: 'seed' });
      expect((await repo.command('stash list', [['--color', 'bad']])).exitCode).toBe(0);
      expect((await repo.command('stash', [{ operand: 'list' }, ['--graph']])).exitCode).toBe(0);
      await writeFile(join(repo.workdir, 'file'), 'two\n');
      expect((await repo.command('stash push', [['--message', 'saved']])).exitCode).toBe(0);
      const invalid = await repo.command('stash list', [['--color', 'bad']]);
      const nativeInvalid = direct(['stash', 'list', '--color=bad']);
      expect(nativeInvalid.status).not.toBe(0);
      expect(invalid.exitCode).toBe(nativeInvalid.status);
      expect(invalid.stderr).toBe(nativeInvalid.stderr);
      expect(invalid.stderr).toContain('color');
      expect((await repo.command('stash list', [['--format', '%gs']])).stdout).toContain('saved');
      const nativeHelp = direct(['stash', 'list', '--decorate=bad', '-h']);
      expect([0, 129]).toContain(nativeHelp.status);
      expect(nativeHelp.stdout + nativeHelp.stderr).toContain('usage:');
      const help = await repo.command('stash list', [['--decorate', 'bad'], ['-h']]);
      expect(help.exitCode).toBe(nativeHelp.status);
      expect(help.stdout).toBe(nativeHelp.stdout);
      expect(help.stderr).toBe(nativeHelp.stderr);
      const nativeGraph = direct(['stash', 'list', '--graph']);
      expect(nativeGraph.status).not.toBe(0);
      const graph = await repo.command('stash', [{ operand: 'list' }, ['--graph']]);
      expect(graph.exitCode).toBe(nativeGraph.status);
      expect(graph.stderr).toBe(nativeGraph.stderr);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
