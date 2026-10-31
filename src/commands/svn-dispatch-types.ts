/** Serialize the SVN API's ordinary long-equals and detached short-value tuples. */
export type SvnWords<A extends readonly unknown[]> = number extends A['length']
  ? readonly string[]
  : A extends readonly [infer H, ...infer R]
    ? H extends { readonly operand: infer W extends string }
      ? readonly [W, ...SvnWords<R>]
      : H extends readonly [infer K extends string, infer V extends string | number | bigint]
        ? K extends `--${string}`
          ? readonly [`${K}=${V}`, ...SvnWords<R>]
          : readonly [K, `${V}`, ...SvnWords<R>]
        : H extends readonly [infer K extends string]
          ? readonly [K, ...SvnWords<R>]
          : readonly string[]
    : readonly [];

/** Scan before option parsing, distributing finite word alternatives independently. */
export type SvnSelect<
  W extends readonly string[],
  Commands extends Readonly<Record<string, string>>,
  Prefix extends readonly string[] = readonly [],
> = number extends W['length']
  ? { kind: 'unknown' }
  : W extends readonly [infer H extends string, ...infer R extends string[]]
    ? string extends H
      ? { kind: 'unknown' }
      : [Extract<H, keyof Commands | 'help'>] extends [never]
        ? SvnSelect<R, Commands, readonly [...Prefix, H]>
        : SvnSelectHead<H, R, Commands, Prefix>
    : { kind: 'none' };

/** Distribute only at a word that can change dispatch; keep inert value unions intact. */
type SvnSelectHead<
  H extends string,
  R extends readonly string[],
  Commands extends Readonly<Record<string, string>>,
  Prefix extends readonly string[],
> = H extends keyof Commands
  ? { kind: 'command'; command: Commands[H]; remaining: readonly [...Prefix, ...R] }
  : H extends 'help'
    ? { kind: 'help' }
    : SvnSelect<R, Commands, readonly [...Prefix, H]>;

/** Recover required option values from words after the command scan. */
export type SvnTokens<
  W extends readonly string[],
  Options,
  Ended extends boolean = false,
> = number extends W['length']
  ? readonly unknown[]
  : W extends readonly [infer H extends string, ...infer R extends string[]]
    ? Ended extends true
      ? readonly [{ readonly operand: H }, ...SvnTokens<R, Options, true>]
      : [H] extends ['--']
        ? readonly [readonly ['--'], ...SvnTokens<R, Options, true>]
        : [H] extends [`--${string}=${string}`]
          ? [H] extends [`${infer K}=${infer V}`]
            ? [K] extends [keyof Options]
              ? readonly [readonly [K, V], ...SvnTokens<R, Options>]
              : never
            : never
          : [H] extends [keyof Options]
            ? Options[H] extends { value: 'flag' }
              ? readonly [readonly [H], ...SvnTokens<R, Options>]
              : Options[H] extends { value: `optional-${string}` }
                ? readonly [readonly [H], ...SvnTokens<R, Options>]
                : R extends readonly [infer V extends string, ...infer Rest extends string[]]
                  ? readonly [readonly [H, V], ...SvnTokens<Rest, Options>]
                  : never
            : [H] extends [`-${string}`]
              ? [H] extends ['-']
                ? readonly [{ readonly operand: H }, ...SvnTokens<R, Options>]
                : never
              : readonly [{ readonly operand: H }, ...SvnTokens<R, Options>]
    : readonly [];
