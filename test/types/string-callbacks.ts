import type { Git } from '../../src/core/git.js';
import type { StringCallbackLiteral } from '../../src/constraints/string-callback-types.js';
declare const git: Git;
declare const dynamic: string;
declare const symbolic: `${string}:`;
declare const invalidUnion: 'verbatim' | 'bogus';

git.command('fast-export', [['--anonymize-map', 'one:two:'], ['-h']]);
git.command('fast-export', [['--anonymize-map', symbolic], ['-h']]);
git.command('fast-export', [['--anonymize-map', dynamic], ['-h']]);
git.command('fast-export', [['-h'], ['--anonymize-map', ':']]);
git.command('fast-import', [['--signed-tags', 'sign-if-invalid=']]);
git.command('fast-import', [['--signed-commits', 'sign-if-invalid=key\n']]);
git.command('fast-import', [['--signed-tags', dynamic]]);
// @ts-expect-error First separator leaves an empty key.
git.command('fast-export', [['--anonymize-map', ':value'], ['-h']]);
// @ts-expect-error First separator leaves an empty replacement.
git.command('fast-export', [['--anonymize-map', 'key:'], ['-h']]);
// @ts-expect-error An empty identity mapping is invalid.
git.command('fast-export', [['--anonymize-map', ''], ['-h']]);
// @ts-expect-error Native names and prefixes are case sensitive.
git.command('fast-import', [['--signed-tags', 'SIGN-IF-INVALID=']]);
// @ts-expect-error Signature modes cannot have trailing whitespace.
git.command('fast-import', [['--signed-commits', 'verbatim ']]);
// @ts-expect-error Known invalid union members must not be discarded.
git.command('fast-import', [['--signed-tags', invalidUnion]]);
// @ts-expect-error Only sign-if-invalid permits the equals suffix.
git.command('fast-import', [['--signed-commits', 'strip=key']]);

type Check<T extends true> = T;
export type StringTemplateCases = readonly [
  Check<StringCallbackLiteral<`${string}:`, 'anonymize-map'>>,
  Check<StringCallbackLiteral<`:${string}`, 'anonymize-map'> extends false ? true : false>,
  Check<StringCallbackLiteral<`${number}:tail`, 'anonymize-map'>>,
  Check<StringCallbackLiteral<`sign-if-invalid=${string}`, 'fast-import-sign'>>,
  Check<StringCallbackLiteral<'x:' | 'x:y:', 'anonymize-map'> extends false ? true : false>,
];
