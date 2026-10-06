import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { gitBoolean, parseGitScalar } from './git-scalars.js';

describe('Git scalar grammars', () => {
  it('matches the independent Git boolean parser across text, base, suffix, sign and overflow boundaries', () => {
    const values = [
      '',
      'true',
      'TRUE',
      'Yes',
      'on',
      'false',
      'NO',
      'Off',
      ' 1',
      '\t-0',
      '+1',
      '-1',
      '0',
      '000',
      '010',
      '08',
      '0x10',
      '-0X1',
      '0b1',
      '1k',
      '0M',
      '1G',
      '-2g',
      '2g',
      '2147483647',
      '2147483648',
      '-2147483648',
      '-2147483649',
      '1.5',
      '1 ',
      'yes ',
      'false\n',
      ' ',
      '\u00a01',
      '0x',
      '99999999999999999999999999999999999999',
    ];
    for (const value of values) {
      const result = spawnSync(
        'git',
        ['-c', `typegit.value=${value}`, 'config', '--type=bool', '--get', 'typegit.value'],
        {
          env: {
            ...process.env,
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
          },
          encoding: 'utf8',
        },
      );
      expect(result.error).toBeUndefined();
      // Git 2.25 rejects INT_MIN; the pinned 2.55 parser accepts it.
      if (
        process.env.TYPE_GIT_USE_LEGACY_VERSION === 'true' &&
        ['-2g', '-2147483648'].includes(value)
      ) {
        expect(result.status).not.toBe(0);
        expect(gitBoolean(value)).toBe(true);
        continue;
      }
      expect(gitBoolean(value), JSON.stringify(value)).toBe(
        result.status === 0 ? result.stdout.trim() === 'true' : undefined,
      );
    }
  });
  it('distinguishes fetch, push, certificate modes and stateful compatibility options', () => {
    expect(parseGitScalar('fetch-recurse', 'on-demand')).toEqual({
      valid: true,
      value: 'on-demand',
    });
    expect(parseGitScalar('fetch-recurse', 'ON-DEMAND').valid).toBe(false);
    expect(parseGitScalar('push-recurse', 'true').valid).toBe(false);
    expect(parseGitScalar('push-recurse', '0k')).toEqual({ valid: true, value: false });
    expect(parseGitScalar('push-recurse', 'only-is-on-demand', 'only')).toEqual({
      valid: true,
      value: 'on-demand',
    });
    expect(parseGitScalar('push-recurse', 'only-is-on-demand', false)).toEqual({
      valid: true,
      value: false,
    });
    expect(parseGitScalar('push-signed', 'IF-ASKED')).toEqual({ valid: true, value: 'if-asked' });
  });
});
