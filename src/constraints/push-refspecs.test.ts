import { describe, expect, it } from 'vitest';
import { validateOptions } from '../core/option-rules.js';
import { parseGitScalar } from './git-scalars.js';
import { validRemoteName } from './push-refspecs.js';

describe('refspec words (builtin/push.c set_refspecs, builtin/fetch.c fetch_one)', () => {
  it('requires a tag name after each tag shorthand', () => {
    expect(parseGitScalar('refspec-words', ['tag', 'v1']).valid).toBe(true);
    expect(parseGitScalar('refspec-words', ['tag', 'tag']).valid).toBe(true);
    expect(parseGitScalar('refspec-words', 'tag').valid).toBe(false);
    expect(parseGitScalar('refspec-words', ['main', 'tag']).valid).toBe(false);
    expect(parseGitScalar('refspec-words', ['tag', 'v1', 'tag']).valid).toBe(false);
    // The repository word is skipped for argv operands.
    expect(parseGitScalar('refspec-operands', ['tag']).valid).toBe(true);
    expect(parseGitScalar('refspec-operands', ['origin', 'tag']).valid).toBe(false);
  });

  it('accepts only plain names under --delete', () => {
    expect(parseGitScalar('push-delete-refspecs', ['main', 'refs/heads/x']).valid).toBe(true);
    expect(parseGitScalar('push-delete-refspecs', ['a:b']).valid).toBe(false);
    expect(parseGitScalar('push-delete-refspecs', [':main']).valid).toBe(false);
    expect(parseGitScalar('push-delete-refspecs', ['']).valid).toBe(false);
    // The word a tag shorthand consumes is not checked.
    expect(parseGitScalar('push-delete-refspecs', ['tag', 'a:b']).valid).toBe(true);
    expect(parseGitScalar('push-delete-operands', ['host:repo', 'main']).valid).toBe(true);
  });

  it('refuses push options that contain a newline', () => {
    expect(parseGitScalar('push-option-text', ['a', 'b c']).valid).toBe(true);
    expect(parseGitScalar('push-option-text', 'a\nb').valid).toBe(false);
    expect(parseGitScalar('push-option-text', ['ok', 'x\n']).valid).toBe(false);
  });
});

describe('repo.push refspec constraints', () => {
  const refused = (options: object): boolean => {
    try {
      validateOptions('push', options);
      return false;
    } catch {
      return true;
    }
  };

  it('needs a remote before refspecs', () => {
    expect(refused({ refspec: 'main' })).toBe(true);
    expect(refused({ remote: 'origin', refspec: 'main' })).toBe(false);
  });

  it('checks tag shorthands, deletion names and push options', () => {
    expect(refused({ remote: 'origin', refspec: ['main', 'tag'] })).toBe(true);
    expect(refused({ remote: 'origin', refspec: ['tag', 'v1'] })).toBe(false);
    expect(refused({ remote: 'origin', deleteRefs: true, refspec: 'a:b' })).toBe(true);
    expect(refused({ remote: 'origin', refspec: 'a:b' })).toBe(false);
    expect(refused({ remote: 'origin', pushOption: 'a\nb' })).toBe(true);
    expect(refused({ remote: 'origin', pushOption: ['a', 'b'] })).toBe(false);
  });
});

describe('repo.fetch refspec constraints', () => {
  const refused = (options: object): boolean => {
    try {
      validateOptions('fetch', options);
      return false;
    } catch {
      return true;
    }
  };

  it('needs a remote before refspecs and a tag name after the tag shorthand', () => {
    expect(refused({ refspec: 'main' })).toBe(true);
    expect(refused({ remote: 'origin', refspec: 'main' })).toBe(false);
    expect(refused({ remote: 'origin', refspec: 'tag' })).toBe(true);
    expect(refused({ remote: 'origin', refspec: ['tag', 'v1'] })).toBe(false);
  });
});

describe('repo.pull forwarded fetch constraints', () => {
  const refused = (options: object): boolean => {
    try {
      validateOptions('pull', options);
      return false;
    } catch {
      return true;
    }
  };

  it('needs a remote before a branch and no remote with all', () => {
    expect(refused({ branch: 'main' })).toBe(true);
    expect(refused({ remote: 'origin', branch: 'main' })).toBe(false);
    expect(refused({ all: true, remote: 'origin' })).toBe(true);
    expect(refused({ all: true })).toBe(false);
  });

  it('refuses a bare tag shorthand and unknown cleanup modes', () => {
    expect(refused({ remote: 'origin', branch: 'tag' })).toBe(true);
    expect(refused({ cleanup: 'scissors' })).toBe(false);
    expect(refused({ cleanup: 'Strip' })).toBe(true);
    expect(refused({ cleanup: '' })).toBe(true);
  });
});

describe('remote names (remote.c valid_remote_name via builtin/clone.c --origin)', () => {
  it('accepts names that form a valid remote-tracking refspec', () => {
    for (const name of ['origin', 'up/stream', 'a.', 'a.b', 'a@b', '@', 'a{b}', 'é', '-x']) {
      expect(validRemoteName(name)).toBe(true);
    }
  });

  it('refuses empty, dotted, locked and forbidden components', () => {
    for (const name of [
      '',
      '.a',
      'a/.b',
      'a..b',
      'a@{b',
      'a.lock',
      'a.lock/b',
      'a//b',
      '/a',
      'a/',
      'a b',
      'a:b',
      'a*',
      'a?',
      'a[b',
      'a\\b',
      'a~b',
      'a^b',
      'a\tb',
      'a\x7fb',
      'a\x01b',
    ]) {
      expect(validRemoteName(name)).toBe(false);
    }
  });

  it('checks git.clone origin and reference combinations', () => {
    const refused = (options: object): boolean => {
      try {
        validateOptions('clone', options);
        return false;
      } catch {
        return true;
      }
    };
    expect(refused({ origin: 'up stream' })).toBe(true);
    expect(refused({ origin: 'upstream' })).toBe(false);
    expect(refused({ recurseSubmodules: true, reference: 'a', referenceIfAble: 'b' })).toBe(true);
    expect(refused({ reference: 'a', referenceIfAble: 'b' })).toBe(false);
  });
});
