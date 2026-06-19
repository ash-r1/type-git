/**
 * Tests for environment variable inheritance control (traversal prevention)
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_ENV_ALLOWLIST, resolveInheritedEnv } from './env.js';

describe('resolveInheritedEnv', () => {
  const parentEnv = {
    PATH: '/usr/bin:/bin',
    HOME: '/home/user',
    SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
    AWS_SECRET_ACCESS_KEY: 'super-secret',
    MY_API_TOKEN: 'token-value',
    UNDEFINED_VAR: undefined,
  };

  describe('default behavior (allowlist)', () => {
    it('inherits allowlisted variables', () => {
      const result = resolveInheritedEnv(parentEnv);

      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.HOME).toBe('/home/user');
      expect(result.SSH_AUTH_SOCK).toBe('/tmp/ssh-agent.sock');
    });

    it('does NOT inherit sensitive variables outside the allowlist', () => {
      const result = resolveInheritedEnv(parentEnv);

      expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      expect(result.MY_API_TOKEN).toBeUndefined();
    });

    it('drops variables with undefined values', () => {
      const result = resolveInheritedEnv(parentEnv);

      expect('UNDEFINED_VAR' in result).toBe(false);
    });
  });

  describe('inheritEnv: true', () => {
    it('inherits the entire parent environment', () => {
      const result = resolveInheritedEnv(parentEnv, true);

      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.AWS_SECRET_ACCESS_KEY).toBe('super-secret');
      expect(result.MY_API_TOKEN).toBe('token-value');
    });

    it('still drops undefined values', () => {
      const result = resolveInheritedEnv(parentEnv, true);

      expect('UNDEFINED_VAR' in result).toBe(false);
    });
  });

  describe('inheritEnv: false', () => {
    it('inherits nothing', () => {
      const result = resolveInheritedEnv(parentEnv, false);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('inheritEnv: string[]', () => {
    it('extends the default allowlist with named variables', () => {
      const result = resolveInheritedEnv(parentEnv, ['MY_API_TOKEN']);

      // Still inherits defaults
      expect(result.PATH).toBe('/usr/bin:/bin');
      // Plus the explicitly opted-in variable
      expect(result.MY_API_TOKEN).toBe('token-value');
      // But not other secrets
      expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    });
  });

  describe('Windows case-insensitive matching', () => {
    it('matches allowlist entries regardless of case on win32', () => {
      const winEnv = {
        Path: 'C:\\Windows',
        SystemRoot: 'C:\\Windows',
        SECRET: 'nope',
      };

      const result = resolveInheritedEnv(winEnv, undefined, 'win32');

      expect(result.Path).toBe('C:\\Windows');
      expect(result.SystemRoot).toBe('C:\\Windows');
      expect(result.SECRET).toBeUndefined();
    });

    it('is case-sensitive on non-Windows platforms', () => {
      const env = { path: '/usr/bin' };

      const result = resolveInheritedEnv(env, undefined, 'linux');

      // Lowercase 'path' should NOT match allowlist entry 'PATH' on linux
      expect(result.path).toBeUndefined();
    });
  });

  describe('DEFAULT_ENV_ALLOWLIST', () => {
    it('includes PATH and HOME', () => {
      expect(DEFAULT_ENV_ALLOWLIST).toContain('PATH');
      expect(DEFAULT_ENV_ALLOWLIST).toContain('HOME');
    });

    it('includes the SSH transport and TLS configuration variables', () => {
      // Git config commonly needed for fetch/push to keep working by default
      const gitTransportVars = [
        'GIT_SSH',
        'GIT_SSH_COMMAND',
        'GIT_SSH_VARIANT',
        'GIT_SSL_CAINFO',
        'GIT_SSL_CAPATH',
        'GIT_TERMINAL_PROMPT',
        'GIT_CONFIG_NOSYSTEM',
      ];
      for (const name of gitTransportVars) {
        expect(DEFAULT_ENV_ALLOWLIST).toContain(name);
      }
    });

    it('excludes credential-carrying / askpass variables (opt-in only)', () => {
      // These can carry inline credentials or run a helper that reads secrets from the
      // environment, so they are not inherited by default to preserve the
      // traversal-prevention model.
      for (const name of ['GIT_ASKPASS', 'SSH_ASKPASS', 'GIT_PROXY_COMMAND']) {
        expect(DEFAULT_ENV_ALLOWLIST).not.toContain(name);
      }
    });
  });

  it('inherits a custom GIT_SSH_COMMAND by default', () => {
    const result = resolveInheritedEnv({ GIT_SSH_COMMAND: 'ssh -i /path/to/key' });

    expect(result.GIT_SSH_COMMAND).toBe('ssh -i /path/to/key');
  });

  it('does not inherit GIT_ASKPASS by default but can opt in', () => {
    expect(resolveInheritedEnv({ GIT_ASKPASS: '/usr/bin/my-askpass' }).GIT_ASKPASS).toBeUndefined();

    const optedIn = resolveInheritedEnv({ GIT_ASKPASS: '/usr/bin/my-askpass' }, ['GIT_ASKPASS']);
    expect(optedIn.GIT_ASKPASS).toBe('/usr/bin/my-askpass');
  });
});
