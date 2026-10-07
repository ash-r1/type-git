import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/boolean-callback-corpus.json';
import type { GitBooleanCallback } from '../constraints/git-boolean.js';
import { gitBoolean, parseGitScalar } from '../constraints/git-scalars.js';
import { GitArgumentError } from '../core/types.js';
import { commandArguments } from './build.js';
import type { GitCommandName } from './types.js';

describe('native boolean callback grammar', () => {
  it('matches independently recorded Git boolean values and normalized output', () => {
    for (const row of corpus.booleans) {
      expect(gitBoolean(row.input), JSON.stringify(row.input)).toBe(
        row.valid ? row.normalized : undefined,
      );
    }
  });

  it('matches independent command callback outcomes for every recorded scope and value', () => {
    for (const row of corpus.cases) {
      expect(
        parseGitScalar(row.parser as GitBooleanCallback, row.value).valid,
        JSON.stringify(row),
      ).toBe(row.valid);
      const build = (): string[] =>
        commandArguments(row.command as GitCommandName, [[row.flag, row.value], ['-h']], true);
      if (row.valid) {
        expect(build()).toEqual([row.command, `${row.flag}=${row.value}`, '-h']);
      } else {
        expect(build, JSON.stringify(row)).toThrow(GitArgumentError);
      }
    }
  });

  it('keeps aliases, default values and the source-defined previous-value transition', () => {
    expect(parseGitScalar('pull-rebase', 'm')).toEqual({ valid: true, value: 'merges' });
    expect(parseGitScalar('pull-rebase', 'i')).toEqual({ valid: true, value: 'interactive' });
    expect(parseGitScalar('push-recurse', 'only-is-on-demand', 'only')).toEqual({
      valid: true,
      value: 'on-demand',
    });
    for (const previous of [undefined, false, 'check', 'on-demand']) {
      expect(parseGitScalar('push-recurse', 'only-is-on-demand', previous)).toEqual({
        valid: true,
        value: previous,
      });
    }
    expect(commandArguments('push', [['--signed', undefined], ['-h']])).toEqual([
      'push',
      '--signed',
      '-h',
    ]);
    expect(
      commandArguments('fetch', [['--recurse-submodules'], ['--no-recurse-submodules'], ['-h']]),
    ).toEqual(['fetch', '--recurse-submodules', '--no-recurse-submodules', '-h']);
  });

  it('uses ASCII case matching and preserves the parser exit boundary', () => {
    expect(parseGitScalar('push-signed', 'IF-ASKED')).toEqual({ valid: true, value: 'if-asked' });
    expect(parseGitScalar('push-signed', 'if-asKed').valid).toBe(false);
    expect(parseGitScalar('fetch-recurse', 'ON-DEMAND').valid).toBe(false);
    expect(parseGitScalar('push-recurse', 'true').valid).toBe(false);
    expect(commandArguments('push', [['-h'], ['--recurse-submodules', 'true']])).toEqual([
      'push',
      '-h',
      '--recurse-submodules=true',
    ]);
  });
});
