import type { GitDecimalLiteral } from './git-decimal-types.js';

type DepthParser<Bits extends 32 | 64> = {
  kind: 'decimal';
  longBits: Bits;
  bits: 32;
  signed: true;
  conversion: 'atoi';
  positive: true;
};

type White = ' ' | '\t' | '\r' | '\n' | '\v' | '\f';
type Trim<S extends string, Steps extends readonly unknown[] = []> = Steps['length'] extends 128
  ? string
  : S extends `${White}${infer Rest}`
    ? Trim<Rest, readonly [...Steps, 0]>
    : S;
type SymbolicPrefix<S extends string, Steps extends readonly unknown[] = []> = string extends S
  ? true
  : Steps['length'] extends 128
    ? true
    : S extends `${infer Head}${infer Rest}`
      ? `${number}` extends Head
        ? true
        : `${bigint}` extends Head
          ? true
          : Head extends '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
            ? SymbolicPrefix<Rest, readonly [...Steps, 0]>
            : false
      : false;
type Deferred<V> = V extends string
  ? Trim<V> extends `${'+' | '-'}${infer Rest}`
    ? SymbolicPrefix<Rest>
    : SymbolicPrefix<Trim<V>>
  : false;
type Profile<V, Bits extends 32 | 64> = false extends (
  V extends unknown
    ? V extends `${string}\0${string}`
      ? false
      : Deferred<V> extends true
        ? true
        : GitDecimalLiteral<V, DepthParser<Bits>>
    : never
)
  ? false
  : true;

/** One complete observed atoi profile must accept every known member of the input. */
export type DepthInitialLiteral<V, Bits extends 32 | 64 = 32 | 64> = true extends
  | (32 extends Bits ? Profile<V, 32> : false)
  | (64 extends Bits ? Profile<V, 64> : false)
  ? true
  : false;
