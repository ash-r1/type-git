import { describe, expect, it } from 'vitest';
import { parseGitScalar } from './git-scalars.js';
import { decimalCallbackFamily } from './git-decimal.js';
import {
  parseGitTimestamp,
  timestampCallbackFamily,
  type GitTimestampParser,
} from './git-timestamp.js';

const modern = { kind: 'timestamp', conversion: 'checked', longBits: 64 } as const;
const legacy = { kind: 'timestamp', conversion: 'atoi', longBits: 64 } as const;

describe('revision timestamp conversion', () => {
  it('keeps unsigned64 magnitude checking before sign conversion', () => {
    expect(parseGitTimestamp('-1', modern)).toEqual({ valid: true, value: 18446744073709551615n });
    expect(parseGitTimestamp('18446744073709551615', modern)).toEqual({
      valid: true,
      value: 18446744073709551615n,
    });
    expect(parseGitTimestamp('-18446744073709551615', modern)).toEqual({ valid: true, value: 1 });
    expect(parseGitTimestamp('-0', modern)).toEqual({ valid: true, value: 0 });
    expect(parseGitTimestamp('18446744073709551616', modern)).toEqual({ valid: false });
    expect(parseGitTimestamp('-18446744073709551616', modern)).toEqual({ valid: false });
  });
  it('accepts only the complete decimal language after leading C whitespace', () => {
    expect(parseGitTimestamp(' \t+0001', modern)).toEqual({ valid: true, value: 1 });
    for (const value of ['', ' ', '+', '1x', '1\n', '1 ', '0x10', '1k', '1\0']) {
      expect(parseGitTimestamp(value, modern).valid).toBe(false);
    }
  });
  it('preserves legacy prefix, saturation, int narrowing and uintmax promotion', () => {
    expect(parseGitTimestamp('4294967295', legacy)).toEqual({
      valid: true,
      value: 18446744073709551615n,
    });
    expect(parseGitTimestamp('18446744073709551616', legacy)).toEqual({
      valid: true,
      value: 18446744073709551615n,
    });
    expect(parseGitTimestamp('-2147483648', legacy)).toEqual({
      valid: true,
      value: 18446744071562067968n,
    });
    expect(parseGitTimestamp('', legacy)).toEqual({ valid: true, value: 0 });
    expect(parseGitTimestamp('nonsense', legacy)).toEqual({ valid: true, value: 0 });
    expect(parseGitTimestamp('1x', legacy)).toEqual({ valid: true, value: 1 });
    expect(parseGitTimestamp('4294967295', { ...legacy, longBits: 32 })).toEqual({
      valid: true,
      value: 2147483647,
    });
  });
  it('uses serialized number spelling without silently rounding the bigint state', () => {
    expect(parseGitTimestamp(1e19, modern)).toEqual({ valid: true, value: 10000000000000000000n });
    expect(parseGitTimestamp(1e21, modern).valid).toBe(false);
    expect(parseGitTimestamp(1e21, legacy)).toEqual({ valid: true, value: 1 });
    expect(parseGitTimestamp(true, legacy).valid).toBe(false);
    expect(parseGitTimestamp('1\0', legacy).valid).toBe(false);
  });
  it('applies executable callback selection only to explicitly marked parsers', () => {
    const scalar = (parser: GitTimestampParser, value: string, family: 'modern' | 'legacy') =>
      parseGitScalar(parser, value, undefined, 64, 64, true, undefined, false, {
        'revision-age': family,
      });
    expect(scalar(modern, '1x', 'legacy')).toEqual({ valid: false });
    expect(scalar(modern, '4294967295', 'legacy')).toEqual({ valid: true, value: 4294967295 });
    const marked = { ...modern, nativeCallback: 'revision-age' } as const;
    expect(scalar(marked, '1x', 'legacy')).toEqual({ valid: true, value: 1 });
    expect(scalar(marked, '4294967295', 'legacy')).toEqual({
      valid: true,
      value: 18446744073709551615n,
    });
    expect(scalar(marked, '1x', 'modern')).toEqual({ valid: false });
    expect(scalar(legacy, '1x', 'modern')).toEqual({ valid: true, value: 1 });
  });

  it('keeps timestamp diagnostics independent of revision-count diagnostics', () => {
    const countFailure = { exitCode: 128, stdout: '', stderr: "fatal: 'invalid': not an integer" };
    expect(decimalCallbackFamily('revision-age', countFailure)).toBeUndefined();
    expect(decimalCallbackFamily('revision-count', countFailure)).toBe('modern');
    const ageFailure = {
      exitCode: 128,
      stdout: '',
      stderr: "fatal: 'invalid': not a number of seconds since epoch",
    };
    expect(decimalCallbackFamily('revision-age', ageFailure)).toBe('modern');
    expect(decimalCallbackFamily('revision-count', ageFailure)).toBeUndefined();
  });

  it('recognizes only positive callback evidence', () => {
    expect(
      timestampCallbackFamily({
        exitCode: 128,
        stdout: '',
        stderr: "fatal: 'invalid': not a number of seconds since epoch",
      }),
    ).toBe('modern');
    expect(
      timestampCallbackFamily({ exitCode: 129, stdout: '', stderr: 'usage: git rev-list' }),
    ).toBe('legacy');
    expect(
      timestampCallbackFamily({ exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }),
    ).toBeUndefined();
    expect(
      timestampCallbackFamily({ exitCode: 129, stdout: 'usage:', stderr: 'error: unknown option' }),
    ).toBeUndefined();
  });
});
