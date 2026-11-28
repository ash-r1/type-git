import { describe, expect, it } from 'vitest';
import {
  canonicalConfigKey,
  validCloneConfigParameters,
  validCloneConfigRemoteName,
} from './config-parameters.js';

describe('config keys (config.c do_parse_config_key)', () => {
  it('lowercases the section and variable and keeps the subsection', () => {
    expect(canonicalConfigKey('Core.Bare')).toBe('core.bare');
    expect(canonicalConfigKey('Remote.Up Stream.URL')).toBe('remote.Up Stream.url');
    expect(canonicalConfigKey('.x.y')).toBe('.x.y');
  });

  it('refuses keys without a section or variable, or with invalid characters', () => {
    for (const key of ['a', '.a', 'a.', 'a.1b', 'a b.c', 'a.b_c', 'a.b\nc.d', 'a.b.c\nd']) {
      expect(canonicalConfigKey(key)).toBeUndefined();
    }
  });
});

describe('clone --config parameters (builtin/clone.c write_config, git_clone_config)', () => {
  it('checks keys and the values that git_clone_config parses', () => {
    expect(validCloneConfigParameters(['a.b', 'a.b=', 'sec.sub.var=1'])).toBe(true);
    expect(validCloneConfigParameters(['=x'])).toBe(false);
    expect(validCloneConfigParameters(['a=b'])).toBe(false);
    expect(validCloneConfigParameters(['clone.defaultRemoteName'])).toBe(false);
    expect(validCloneConfigParameters(['clone.defaultRemoteName='])).toBe(true);
    expect(validCloneConfigParameters(['Clone.RejectShallow=maybe'])).toBe(false);
    expect(validCloneConfigParameters(['clone.rejectShallow', 'clone.filterSubmodules=1k'])).toBe(
      true,
    );
  });

  it('checks the last clone.defaultRemoteName as a remote name', () => {
    expect(validCloneConfigRemoteName(['clone.defaultRemoteName=a b'])).toBe(false);
    expect(validCloneConfigRemoteName(['clone.defaultRemoteName='])).toBe(false);
    expect(
      validCloneConfigRemoteName(['clone.defaultRemoteName=a b', 'clone.defaultremotename=up']),
    ).toBe(true);
    expect(validCloneConfigRemoteName(['core.bare=true'])).toBe(true);
  });
});
