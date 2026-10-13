import type { MainlineLiteral, MainlineValue } from '../../src/constraints/mainline-types.js';
// Native builtin/revert.c conversions under LP64 and LLP64. A declaration
// cannot choose the host ABI, so only universally invalid literals reject.
type Check<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type MainlineConversions = readonly [
  Check<Equal<MainlineValue<1>, 1>>,
  Check<Equal<MainlineValue<2147483647>, 2147483647>>,
  Check<Equal<MainlineValue<2147483648>, 2147483647>>,
  Check<Equal<MainlineValue<4294967296>, 2147483647>>,
  Check<Equal<MainlineValue<4294967297>, 1 | 2147483647>>,
  Check<Equal<MainlineValue<-4294967295>, 1>>,
  Check<Equal<MainlineValue<-2147483649>, 2147483647>>,
  Check<Equal<MainlineValue<8589934593>, 1 | 2147483647>>,
  Check<Equal<MainlineValue<9007199254740991>, 2147483647>>,
  Check<Equal<MainlineValue<-9007199254740991>, 1>>,
  Check<Equal<MainlineValue<0>, never>>,
  Check<Equal<MainlineValue<-1>, never>>,
  Check<Equal<MainlineValue<-2147483648>, never>>,
  Check<Equal<MainlineLiteral<0>, false>>,
  Check<Equal<MainlineLiteral<0 | 1>, false>>,
  Check<Equal<MainlineLiteral<1.5>, false>>,
  Check<Equal<MainlineLiteral<9007199254740992>, false>>,
  Check<Equal<MainlineLiteral<number>, true>>,
  Check<Equal<MainlineValue<number>, number>>,
];
declare const nominal: unique symbol;
type Branded = number & { readonly [nominal]: true };
export type DynamicMainline = readonly [
  Check<Equal<MainlineLiteral<Branded>, true>>,
  Check<Equal<MainlineValue<Branded>, number>>,
];
