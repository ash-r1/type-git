import type { CommandSpec } from './spec.js';

/** Preserve named integer tuple representations after native word tokenization. */
export function initialParserInputs(
  spec: CommandSpec,
  args: readonly unknown[],
  tokens: readonly (readonly string[])[],
): readonly (readonly unknown[])[] {
  const values = new Map<string, unknown[]>();
  for (const arg of args) {
    if (!Array.isArray(arg) || typeof arg[0] !== 'string') {
      continue;
    }
    const parser = spec.options[arg[0]]?.parser;
    if (typeof parser !== 'object' || parser.kind !== 'integer') {
      continue;
    }
    const queue = values.get(arg[0]) ?? [];
    queue.push(arg[1]);
    values.set(arg[0], queue);
  }
  return tokens.map((token) => {
    const value = values.get(token[0]!)?.shift();
    return token.length === 2 && typeof value === 'number' && String(value) === token[1]
      ? [token[0], value]
      : token;
  });
}

type Missing = { found: false };
type OriginalValue<
  A extends readonly unknown[],
  F extends string,
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? Missing
  : A extends readonly [infer H, ...infer R]
    ? H extends readonly [F, ...infer V]
      ? { found: true; value: V[0]; remaining: R }
      : OriginalValue<R, F, readonly [...N, 0]>
    : Missing;
type IsInteger<S, F extends string> = S extends { options: infer O }
  ? F extends keyof O
    ? O[F] extends { parser: { kind: 'integer' } }
      ? true
      : false
    : false
  : false;
type RestoredToken<H, V> = H extends readonly [infer F, infer Text extends string]
  ? V extends string | number | bigint | boolean
    ? `${V}` extends Text
      ? V extends number
        ? readonly [F, V]
        : H
      : never
    : H
  : H;
type Restore<
  S,
  A extends readonly unknown[],
  T extends readonly unknown[],
  Out extends readonly unknown[] = [],
  N extends readonly unknown[] = [],
> = N['length'] extends 128
  ? readonly [...Out, ...T]
  : T extends readonly [infer H, ...infer R]
    ? H extends readonly [infer F extends string, ...unknown[]]
      ? IsInteger<S, F> extends true
        ? OriginalValue<A, F> extends infer V
          ? V extends {
              found: true;
              value: infer Raw;
              remaining: infer Next extends readonly unknown[];
            }
            ? Restore<S, Next, R, readonly [...Out, RestoredToken<H, Raw>], readonly [...N, 0]>
            : Restore<S, A, R, readonly [...Out, H], readonly [...N, 0]>
          : never
        : Restore<S, A, R, readonly [...Out, H], readonly [...N, 0]>
      : Restore<S, A, R, readonly [...Out, H], readonly [...N, 0]>
    : Out;
/** Keep literal number checks aligned with runtime while untouched words stay text. */
export type InitialParserInputs<S, A extends readonly unknown[], T extends readonly unknown[]> = [
  Extract<A[number], readonly [string, number]>,
] extends [never]
  ? T
  : Restore<S, A, T>;
