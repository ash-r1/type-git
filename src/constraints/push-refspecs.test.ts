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

  it('parses the refspec each tag shorthand and deleted name expands to', () => {
    // Observed with Git 2.55.0: push origin tag <x>, push --delete origin [tag] <x>, fetch.
    const push = (words: string[]) => parseGitScalar('refspec-operands', ['origin', ...words]);
    const del = (words: string[]) => parseGitScalar('push-delete-operands', ['origin', ...words]);
    const fetch = (words: string[]) =>
      parseGitScalar('fetch-refspec-operands', ['origin', ...words]);
    for (const tag of ['', 'bad name', 'a.', 'a*b*', '.x', 'x.lock']) {
      expect(push(['tag', tag]).valid, tag).toBe(false);
      expect(del(['tag', tag]).valid, tag).toBe(false);
      expect(fetch(['tag', tag]).valid, tag).toBe(false);
    }
    for (const tag of ['v1', 'tag', '@']) {
      expect(push(['tag', tag]).valid, tag).toBe(true);
      expect(del(['tag', tag]).valid, tag).toBe(true);
      expect(fetch(['tag', tag]).valid, tag).toBe(true);
    }
    // A glob is a push or fetch pattern, but a deletion cannot be one.
    for (const tag of ['v*', '*']) {
      expect(push(['tag', tag]).valid, tag).toBe(true);
      expect(del(['tag', tag]).valid, tag).toBe(false);
      expect(fetch(['tag', tag]).valid, tag).toBe(true);
    }
    // A ':' splits the push refspec, so only its right side must be a ref name; fetch repeats
    // the name on both sides and always refuses it.
    for (const tag of ['a:b', 'x y:z']) {
      expect(push(['tag', tag]).valid, tag).toBe(true);
      expect(del(['tag', tag]).valid, tag).toBe(true);
      expect(fetch(['tag', tag]).valid, tag).toBe(false);
    }
    expect(push(['tag', 'a:b c']).valid).toBe(false);
    for (const name of ['bad name', 'a..b', '@', 'x.lock', '*', 'a*', 'a.']) {
      expect(del([name]).valid, name).toBe(false);
    }
    for (const name of ['main', 'refs/heads/main', 'HEAD']) {
      expect(del([name]).valid, name).toBe(true);
    }
  });

  it('parses every other refspec word as Git does before any transport', () => {
    // Observed with Git 2.55.0: push --dry-run origin <x> and fetch --dry-run origin <x>.
    const push = (word: string) => parseGitScalar('refspec-operands', ['origin', word]).valid;
    const fetch = (word: string) =>
      parseGitScalar('fetch-refspec-operands', ['origin', word]).valid;
    for (const word of ['bad name', 'HEAD~1', 'main~', '+bad name', '^', '^a:b']) {
      expect(push(word), word).toBe(false);
      expect(fetch(word), word).toBe(false);
    }
    for (const word of ['main', '+main', '^main', '@', ':', ':b', '*:*', 'HEAD~1:refs/heads/x']) {
      expect(push(word), word).toBe(true);
    }
    for (const word of ['main', '+main', '^main', '@', '', '+', ':', 'a:', ':b', '*:*']) {
      expect(fetch(word), word).toBe(true);
    }
    // A push needs a source or a destination; fetch reads an empty side as HEAD or no store.
    for (const word of ['', '+', 'a:']) {
      expect(push(word), word).toBe(false);
    }
    // A pattern without a destination is a push pattern but not a fetch refspec.
    expect(push('a*')).toBe(true);
    expect(fetch('a*')).toBe(false);
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
    expect(refused({ remote: '', refspec: 'main' })).toBe(true);
    expect(refused({ refspec: [] })).toBe(false);
    expect(refused({ remote: 'origin', refspec: 'main' })).toBe(false);
  });

  it('checks tag shorthands, deletion names and push options', () => {
    expect(refused({ remote: 'origin', refspec: ['main', 'tag'] })).toBe(true);
    expect(refused({ remote: 'origin', refspec: ['tag', 'v1'] })).toBe(false);
    expect(refused({ remote: 'origin', refspec: ['tag', ''] })).toBe(true);
    expect(refused({ remote: 'origin', deleteRefs: true, refspec: 'bad name' })).toBe(true);
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
    expect(refused({ remote: '', refspec: 'main' })).toBe(true);
    expect(refused({ refspec: [] })).toBe(false);
    expect(refused({ remote: 'origin', refspec: 'main' })).toBe(false);
    expect(refused({ remote: 'origin', refspec: 'tag' })).toBe(true);
    expect(refused({ remote: 'origin', refspec: ['tag', 'v1'] })).toBe(false);
    expect(refused({ remote: 'origin', refspec: ['tag', ''] })).toBe(true);
    expect(refused({ remote: 'origin', refspec: ['tag', 'a:b'] })).toBe(true);
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
    // Empty values are not emitted, so they neither need nor supply a remote.
    expect(refused({ remote: '', branch: 'main' })).toBe(true);
    expect(refused({ branch: '' })).toBe(false);
    expect(refused({ all: true, remote: '' })).toBe(false);
    expect(refused({ cleanup: '' })).toBe(false);
    expect(refused({ remote: 'origin', branch: 'main' })).toBe(false);
    expect(refused({ all: true, remote: 'origin' })).toBe(true);
    expect(refused({ all: true })).toBe(false);
  });

  it('refuses a bare tag shorthand and unknown cleanup modes', () => {
    expect(refused({ remote: 'origin', branch: 'tag' })).toBe(true);
    expect(refused({ cleanup: 'scissors' })).toBe(false);
    expect(refused({ cleanup: 'Strip' })).toBe(true);
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
