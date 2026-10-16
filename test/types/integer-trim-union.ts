import type { Trim } from '../../src/constraints/git-integer-types.js';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type TrimmedUnion = Assert<Equal<Trim<' 1' | '1'>, '1'>>;
type MixedUnion = Assert<Equal<Trim<'\t1' | '\r2' | '2'>, '1' | '2'>>;
type NoWhitespace = Assert<Equal<Trim<'1' | '2'>, '1' | '2'>>;
type Symbolic = Assert<Equal<Trim<string>, string>>;
type Empty = Assert<Equal<Trim<'' | ' '>, ''>>;

export type TrimUnionContracts = [TrimmedUnion, MixedUnion, NoWhitespace, Symbolic, Empty];
