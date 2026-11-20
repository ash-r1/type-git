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

  describe('inheritEnv: { add, remove }', () => {
    it('adds named variables on top of the default allowlist', () => {
      const result = resolveInheritedEnv(parentEnv, { add: ['MY_API_TOKEN'] });

      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.MY_API_TOKEN).toBe('token-value');
      expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    });

    it('removes a single default entry while keeping the rest', () => {
      const result = resolveInheritedEnv(parentEnv, { remove: ['SSH_AUTH_SOCK'] });

      // The targeted default is dropped...
      expect(result.SSH_AUTH_SOCK).toBeUndefined();
      // ...but other defaults remain.
      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.HOME).toBe('/home/user');
    });

    it('lets remove take precedence over add', () => {
      const result = resolveInheritedEnv(parentEnv, {
        add: ['MY_API_TOKEN'],
        remove: ['MY_API_TOKEN'],
      });

      expect(result.MY_API_TOKEN).toBeUndefined();
    });

    it('treats an empty adjustment like the default allowlist', () => {
      const result = resolveInheritedEnv(parentEnv, {});

      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.SSH_AUTH_SOCK).toBe('/tmp/ssh-agent.sock');
      expect(result.MY_API_TOKEN).toBeUndefined();
    });

    it('removes default entries case-insensitively on win32', () => {
      const winEnv = {
        Path: 'C:\\Windows',
        SSH_AUTH_SOCK: '/tmp/agent.sock',
      };

      const result = resolveInheritedEnv(winEnv, { remove: ['ssh_auth_sock'] }, 'win32');

      expect(result.Path).toBe('C:\\Windows');
      expect(result.SSH_AUTH_SOCK).toBeUndefined();
    });
  });

  describe('inheritEnv: predicate', () => {
    it('inherits only variables for which the predicate returns true', () => {
      const result = resolveInheritedEnv(parentEnv, (name) => name === 'MY_API_TOKEN');

      // Bypasses the default allowlist entirely.
      expect(result.MY_API_TOKEN).toBe('token-value');
      expect(result.PATH).toBeUndefined();
      expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    });

    it('can build on top of the default allowlist', () => {
      const allow = new Set(DEFAULT_ENV_ALLOWLIST);
      const result = resolveInheritedEnv(
        parentEnv,
        (name) => allow.has(name) && name !== 'SSH_AUTH_SOCK',
      );

      expect(result.PATH).toBe('/usr/bin:/bin');
      expect(result.SSH_AUTH_SOCK).toBeUndefined();
    });

    it('still drops undefined values', () => {
      const result = resolveInheritedEnv(parentEnv, () => true);

      expect('UNDEFINED_VAR' in result).toBe(false);
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

    it('includes the data-only SSH transport and TLS configuration variables', () => {
      // Git config commonly needed for fetch/push to keep working by default
      const gitTransportVars = [
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

    it('excludes every variable that names a program Git runs (opt-in only)', () => {
      // Whoever controls the parent environment would otherwise choose a command for every
      // fetch or push, and askpass helpers can read secrets from the environment.
      for (const name of [
        'GIT_SSH',
        'GIT_SSH_COMMAND',
        'GIT_ASKPASS',
        'SSH_ASKPASS',
        'GIT_PROXY_COMMAND',
        'GIT_EDITOR',
        'GIT_SEQUENCE_EDITOR',
        'EDITOR',
        'VISUAL',
        'GIT_PAGER',
        'PAGER',
        'GIT_EXTERNAL_DIFF',
        'GIT_EXEC_PATH',
        'GIT_TEMPLATE_DIR',
        'GIT_CONFIG',
        'GIT_CONFIG_GLOBAL',
        'GIT_CONFIG_SYSTEM',
        'GIT_CONFIG_COUNT',
        'GIT_CONFIG_PARAMETERS',
      ]) {
        expect(DEFAULT_ENV_ALLOWLIST).not.toContain(name);
      }
    });
  });

  it('does not inherit GIT_SSH or GIT_SSH_COMMAND by default but can opt in', () => {
    const parent = { GIT_SSH: '/usr/bin/my-ssh', GIT_SSH_COMMAND: 'ssh -i /path/to/key' };
    const result = resolveInheritedEnv(parent);
    expect(result.GIT_SSH).toBeUndefined();
    expect(result.GIT_SSH_COMMAND).toBeUndefined();

    const optedIn = resolveInheritedEnv(parent, ['GIT_SSH_COMMAND']);
    expect(optedIn.GIT_SSH_COMMAND).toBe('ssh -i /path/to/key');
    expect(optedIn.GIT_SSH).toBeUndefined();
  });

  it('does not inherit GIT_ASKPASS by default but can opt in', () => {
    expect(resolveInheritedEnv({ GIT_ASKPASS: '/usr/bin/my-askpass' }).GIT_ASKPASS).toBeUndefined();

    const optedIn = resolveInheritedEnv({ GIT_ASKPASS: '/usr/bin/my-askpass' }, ['GIT_ASKPASS']);
    expect(optedIn.GIT_ASKPASS).toBe('/usr/bin/my-askpass');
  });
});
