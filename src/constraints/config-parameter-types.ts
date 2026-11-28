import type { ConfigParameterParser } from './config-parameters.js';

/** The key of a literal parameter: the text before its first '='. */
type ParameterKey<P> = P extends `${infer K}=${string}` ? K : P;
/** Certain key refusals (no section or variable name); finer key grammar stays runtime. */
type KeyInvalid<K> = string extends K
  ? false
  : K extends ''
    ? true
    : K extends `${string}.${string}`
      ? K extends `${string}.`
        ? true
        : K extends `.${infer R}`
          ? R extends `${string}.${string}`
            ? false
            : true
          : false
      : true;
type ListInvalid<V> = V extends string
  ? KeyInvalid<ParameterKey<V>>
  : V extends readonly (infer E)[]
    ? true extends ListInvalid<E>
      ? true
      : false
    : false;

/** Whether a literal value passes the selected config parameter parser. */
export type ConfigParameterLiteral<
  V,
  P extends ConfigParameterParser,
> = P extends 'clone-config-parameters' ? (ListInvalid<V> extends true ? false : true) : true;
