import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/phased-parser-exit-corpus.json';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import { COMMAND_SPECS } from './generated.js';
import { initialParserPass } from './initial-parser-pass.js';
import type { GitCommandName } from './types.js';

describe('initial parser exits before deferred revision/diff callbacks', () => {
  it('matches the independent Git corpus without reordering the serialized argv', () => {
    for (const row of corpus.cases) {
      const build = () => commandArguments(row.command as GitCommandName, row.tokens, true);
      if (row.valid) {
        expect(build(), JSON.stringify(row.argv)).toEqual(row.argv);
      } else {
        expect(build, JSON.stringify(row.argv)).toThrow(GitArgumentError);
      }
    }
  });

  it('skips deferred integer conversions at help but rejects them before later overwrites otherwise', async () => {
    const root = await mkdtemp(join(tmpdir(), 'type-git-integer-phases-'));
    const env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(root, 'config'),
      LC_ALL: 'C',
    };
    const run = (argv: string[]) => {
      const result = spawnSync('git', ['-C', root, ...argv], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      expect(result.error).toBeUndefined();
      return result;
    };
    try {
      expect(run(['init']).status).toBe(0);
      for (const flag of ['--unified', '--inter-hunk-context']) {
        const tokens = [
          [flag, 'invalid'],
          [flag, 1],
        ];
        const argv = ['log', `${flag}=invalid`, `${flag}=1`];
        const help = run([...argv, '-h']);
        expect([0, 129], help.stderr).toContain(help.status);
        expect(help.stderr + help.stdout).toMatch(/^usage:/);
        expect(commandArguments('log', [...tokens, ['-h']], true)).toEqual([...argv, '-h']);
        const reached = run(argv);
        expect([128, 129]).toContain(reached.status);
        expect(reached.stderr).toMatch(/expects|not an integer/);
        expect(() => commandArguments('log', tokens, true)).toThrow('invalid integer');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps value shape and NUL checks for deferred and post-exit tokens', () => {
    for (const tokens of [
      [['--color', 'bad\0'], ['-h']],
      [['--color', 7], ['-h']],
      [['-h'], ['--decorate', 'bad\0']],
      [['--color', 'bad'], ['-h'], { operand: 'bad\0' }],
      [['--unknown'], ['-h']],
      [{ operand: '--decorate=bad' }, ['-h']],
    ]) {
      expect(() => commandArguments('log', tokens)).toThrow(GitArgumentError);
    }
  });

  it('generates first-pass recognition from the source tables including aliases and negation', () => {
    expect(COMMAND_SPECS.log.parserExit.firstPassOptions).toEqual(
      expect.arrayContaining([
        '--decorate',
        '--no-decorate',
        '--mailmap',
        '--no-mailmap',
        '-q',
        '-L',
        '-h',
      ]),
    );
    expect(COMMAND_SPECS.log.parserExit.firstPassOptions).not.toContain('--color');
    expect(COMMAND_SPECS['fast-export'].parserExit.firstPassOptions).toContain('--progress');
    expect(COMMAND_SPECS['cherry-pick'].parserExit.firstPassOptions).toContain('--empty');
    expect(COMMAND_SPECS.revert.parserExit.firstPassOptions).not.toContain('--empty');
  });
  it('does not mistake consumed help or either boundary for an initial-pass exit', () => {
    expect(initialParserPass(COMMAND_SPECS.log, ['-G', '-L', '-h'])).toEqual({
      exited: false,
      tokens: [['-L', '-h']],
      remaining: ['-G'],
    });
    for (const boundary of ['--', '--end-of-options']) {
      expect(initialParserPass(COMMAND_SPECS.log, ['--default', boundary, '-h']).exited).toBe(
        false,
      );
    }
  });
});
