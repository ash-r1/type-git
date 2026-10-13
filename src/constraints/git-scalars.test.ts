import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { nativeCLongBits } from './c-abi.js';
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
      // The recorded Git 2.55/C23 libc profile accepts binary notation. Some
      // installed Git/libc profiles (including Windows CI) reject it. Verify
      // that known profile boundary explicitly rather than claiming agreement.
      if (value === '0b1' && result.status !== 0) {
        expect(result.stderr).toContain('bad boolean');
        expect(gitBoolean(value)).toBe(true);
        continue;
      }
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
  it('binds ILP32, LP64 and LLP64 mainline conversions to the host architecture', () => {
    for (const [platform, architecture, expected] of [
      ['linux', 'ia32', 32],
      ['linux', 'arm', 32],
      ['linux', 'ppc', 32],
      ['linux', 's390', 32],
      ['linux', 'x64', 64],
      ['linux', 'arm64', 64],
      ['linux', 'ppc64', 64],
      ['linux', 's390x', 64],
      ['darwin', 'arm64', 64],
      ['win32', 'x64', 32],
      ['win32', 'arm64', 32],
      ['win32', 'ia32', 32],
    ] as const) {
      const bits = nativeCLongBits(platform, architecture);
      expect(bits).toBe(expected);
      expect(parseGitScalar('mainline', 4294967296, undefined, bits)).toEqual(
        bits === 32 ? { valid: true, value: 2147483647 } : { valid: false, value: 0 },
      );
      expect(parseGitScalar('mainline', -4294967295, undefined, bits)).toEqual(
        bits === 32 ? { valid: false, value: -2147483648 } : { valid: true, value: 1 },
      );
    }
  });
});
