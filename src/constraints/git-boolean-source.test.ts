import { describe, expect, it } from 'vitest';
import corpus from '../../test/fixtures/boolean-callback-corpus.json';
import differences from '../../test/fixtures/boolean-source-overrides.json';
import {
  gitBoolean,
  parseBooleanCallback,
  type GitBooleanCallback,
  type GitBooleanSource,
} from './git-boolean.js';

describe('native-derived boolean source families', () => {
  for (const profile of differences.profiles) {
    it(`matches all config and callback values recorded on ${profile.version}`, () => {
      const source = profile.source as GitBooleanSource;
      for (const row of corpus.booleans) {
        const expected = profile.booleanOverrides.find((entry) => entry.input === row.input) ?? row;
        expect(
          gitBoolean(row.input, source),
          `${profile.version} config ${JSON.stringify(row.input)}`,
        ).toBe(
          expected.valid ? ('normalized' in expected ? expected.normalized : undefined) : undefined,
        );
      }
      for (const row of corpus.cases) {
        const expected =
          profile.callbackOverrides.find(
            (entry) =>
              entry.command === row.command && entry.flag === row.flag && entry.value === row.value,
          ) ?? row;
        expect(
          parseBooleanCallback(row.parser as GitBooleanCallback, row.value, undefined, source)
            .valid,
          `${profile.version} ${row.command} ${row.flag}=${row.value}`,
        ).toBe(expected.valid);
      }
    });
  }
  it('keeps enum support independent of integer grammar when explicitly observed', () => {
    expect(
      parseBooleanCallback('pull-rebase', 'preserve', undefined, 'modern', true, {
        preserve: true,
      }),
    ).toEqual({ valid: true, value: 'preserve' });
    expect(
      parseBooleanCallback('pull-rebase', 'p', undefined, 'legacy-units', true, {
        preserve: false,
      }),
    ).toEqual({ valid: false });
    expect(
      parseBooleanCallback('push-recurse', 'only-is-on-demand', 'only', 'legacy-units', true, {
        onlyIsOnDemand: true,
      }),
    ).toEqual({ valid: true, value: 'on-demand' });
    expect(
      parseBooleanCallback('push-recurse', 'only-is-on-demand', 'only', 'symmetric', true, {
        onlyIsOnDemand: false,
      }),
    ).toEqual({ valid: false });
  });
  it('preserves the source-specific normalized meaning of rebase m and transition state', () => {
    expect(parseBooleanCallback('pull-rebase', 'm', undefined, 'legacy-units')).toEqual({
      valid: true,
      value: false,
    });
    expect(parseBooleanCallback('pull-rebase', 'm', undefined, 'modern')).toEqual({
      valid: true,
      value: 'merges',
    });
    expect(parseBooleanCallback('push-recurse', 'only-is-on-demand', 'only', 'symmetric')).toEqual({
      valid: true,
      value: 'on-demand',
    });
    expect(parseBooleanCallback('push-recurse', 'only-is-on-demand', undefined, 'modern')).toEqual({
      valid: true,
      value: undefined,
    });
    expect(
      parseBooleanCallback('push-recurse', 'only-is-on-demand', 'only', 'legacy-units'),
    ).toEqual({ valid: false });
  });
});
