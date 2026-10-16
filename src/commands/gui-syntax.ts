import type { GitIntegerProfile } from '../constraints/git-integer.js';
import type { GitDecimalCallbacks } from '../constraints/git-decimal.js';
import type { GitBooleanSource } from '../constraints/git-boolean.js';
import { createHash } from 'node:crypto';
import { GitArgumentError } from '../core/types.js';
import type { CommandSpec } from './spec.js';

export type GuiGrammar = 'path-loop' | 'positional';
export type GuiLaunch = 'shell-prelude' | 'direct-tcl';
export type CommandGrammarContext = {
  filenameProfile?: 'legacy' | 'intermediate' | 'optional';
  filenameIgnoredValues?: string;
  guiGrammar?: GuiGrammar;
  guiLaunch?: GuiLaunch;
  conflictStyle?: 'immediate' | 'deferred';
  booleanSource?: GitBooleanSource;
  firstPassEmpty?: boolean;
  /** Pin the parent stash dispatch pass when validating a source-specific corpus. */
  stashParent?: 'legacy' | 'modern';
  /** Pin named decimal callback families while leaving unspecified parser axes selectable. */
  decimalCallbacks?: GitDecimalCallbacks;
  /** Pin observed native integer storage/range handling independently of decimal callbacks. */
  integerProfile?: GitIntegerProfile;
  submoduleInitAlias?: boolean;
  /** Pin whether the selected diff callback rejects every empty pattern. */
  emptyPickaxeRejected?: boolean;
};
export function guiLaunchFromSource(source: string): GuiLaunch | undefined {
  const normalized = source.replaceAll('\r\n', '\n');
  if (
    createHash('sha256').update(normalized).digest('hex') ===
    '39d3370e10041566b2c99af47626999effcdb6056fc55a1075dfb53bd7764721'
  ) {
    return 'direct-tcl';
  }
  if (guiGrammarFromSource(source) !== undefined) {
    return 'shell-prelude';
  }
  return undefined;
}

// Fingerprints cover the complete operation-parser block of the pinned sources,
// excluding install paths and the independently reported application version.
const profiles: Readonly<Record<string, GuiGrammar>> = {
  '5cf2a32a2c9c67e1d3c3a3110f04459ee0cdf2e1cb0eca6eaa4a41176edac792': 'path-loop',
  '3dd16c67314be3a0e8afdfc5687390504609e99322e89b7ed49524be88b3694b': 'positional',
};

export function guiGrammarFromSource(source: string): GuiGrammar | undefined {
  const normalized = source.replaceAll('\r\n', '\n');
  const start = normalized.indexOf('# -- Not a normal commit type invocation?');
  const end = normalized.indexOf('# -- Branch Control', start);
  if (start < 0 || end < 0) {
    return undefined;
  }
  return profiles[createHash('sha256').update(normalized.slice(start, end)).digest('hex')];
}

/** Serialize without moving trace words or assigning meaning from API tags. */
export function guiArguments(
  spec: CommandSpec,
  args: readonly unknown[],
  rootOptions: CommandSpec['options'],
): string[] {
  if (!Array.isArray(args)) {
    throw new GitArgumentError('Command arguments must be an array');
  }
  const words = [...spec.argv];
  for (const arg of args) {
    if (!Array.isArray(arg)) {
      if (
        !arg ||
        typeof arg !== 'object' ||
        !('operand' in arg) ||
        typeof arg.operand !== 'string' ||
        arg.operand.includes('\0')
      ) {
        throw new GitArgumentError('Expected a string operand without NUL');
      }
      words.push(arg.operand);
      continue;
    }
    if (arg.length === 0 || arg.length > 2) {
      throw new GitArgumentError('Invalid GUI option tuple');
    }
    const flag = arg[0];
    if (flag === '--' && arg.length === 1 && spec.separator) {
      words.push('--');
      continue;
    }
    const options = spec.argv.length === 1 ? rootOptions : spec.options;
    if (typeof flag !== 'string' || !Object.hasOwn(options, flag)) {
      throw new GitArgumentError(`Unsupported GUI option: ${String(flag)}`);
    }
    const option = options[flag]!;
    if (option.value === 'flag') {
      if (arg.length > 1 && arg[1] !== undefined) {
        throw new GitArgumentError(`${flag}: this flag takes no value`);
      }
      words.push(flag);
    } else {
      if (arg.length !== 2 || !Number.isSafeInteger(arg[1])) {
        throw new GitArgumentError(`${flag}: expected a safe integer`);
      }
      words.push(`${flag}=${arg[1]}`);
    }
  }
  return words;
}

const line = /^--line=[0-9]+$/;
const hasNonAscii = (word: string): boolean => [...word].some((char) => char.charCodeAt(0) > 127);
const commitOptions = new Set(['--amend', '--nocommit', '--commitmsg']);

/** Validate syntax; object/path existence and GUI operations remain native. */
export function validateGuiArguments(
  argv: readonly string[],
  grammar?: GuiGrammar,
  launch?: GuiLaunch,
): void {
  const words = argv.slice(1);
  if (
    words[0] === '--help' ||
    (launch !== 'direct-tcl' &&
      words.length === 1 &&
      (words[0] === 'version' || words[0] === '--version'))
  ) {
    return;
  }
  if (words[0] === '--working-dir' && words.length >= 2) {
    if (launch === undefined) {
      return;
    }
    if (launch === 'direct-tcl') {
      words.splice(0, 2);
    }
  }
  const trace = words.indexOf('--trace');
  if (trace >= 0) {
    words.splice(trace, 1);
  }
  const operation = argv[0] === 'citool' ? 'citool' : (words.shift() ?? 'gui');
  const fail = (): never => {
    throw new GitArgumentError(`Invalid ${argv[0]} ${operation} argument syntax`);
  };
  if (operation === 'gui' || operation === 'pick' || operation === 'citool') {
    if (operation === 'pick' && grammar === 'path-loop') {
      fail();
    }
    if (operation === 'citool') {
      while (words.length > 0 && commitOptions.has(words[0]!)) {
        words.shift();
      }
    }
    if (words.length > 0) {
      fail();
    }
    return;
  }
  if (operation !== 'browser' && operation !== 'blame') {
    fail();
  }
  if (words.length === 0) {
    fail();
  }
  if (grammar !== 'positional') {
    return;
  }
  if (words.length > (operation === 'browser' ? 3 : 4)) {
    fail();
  }
  // Tcl's Unicode digit tables depend on the selected interpreter. The
  // independent count/separator checks remain valid; ambiguous digit words
  // defer order/revision checks to Tcl rather than using JavaScript's tables.
  const ambiguous = words
    .slice(0, -1)
    .some((word) => word.startsWith('--line=') && hasNonAscii(word));
  let head = '';
  for (const [index, word] of words.slice(0, -1).entries()) {
    if (word === '--') {
      if (index !== words.length - 2) {
        fail();
      }
    } else if (!ambiguous) {
      if (line.test(word) && !word.endsWith('\n')) {
        if (index !== 0 || operation !== 'blame') {
          fail();
        }
      } else if (head === '') {
        head = word;
      } else {
        fail();
      }
    }
  }
}

type Word<T> = T extends { readonly operand: infer W extends string }
  ? W
  : T extends readonly [infer K extends string, infer V extends number]
    ? `${K}=${V}`
    : T extends readonly [infer K extends string]
      ? K
      : string;
type Words<
  A extends readonly unknown[],
  R extends readonly string[] = readonly [],
> = A extends readonly [infer H, ...infer T] ? Words<T, readonly [...R, Word<H>]> : R;
type RemoveTrace<
  W extends readonly string[],
  R extends readonly string[] = readonly [],
> = W extends readonly [infer H extends string, ...infer T extends readonly string[]]
  ? H extends '--trace'
    ? readonly [...R, ...T]
    : RemoveTrace<T, readonly [...R, H]>
  : R;
type Opaque<W extends string> = string extends W
  ? true
  : W extends object
    ? true
    : {} extends Record<W, unknown>
      ? true
      : false;
type HasOpaque<W extends readonly string[]> = W extends readonly [
  infer H extends string,
  ...infer T extends readonly string[],
]
  ? Opaque<H> extends true
    ? true
    : HasOpaque<T>
  : false;
type Digits<S extends string, D extends readonly unknown[] = readonly []> = D['length'] extends 128
  ? 'unknown'
  : S extends ''
    ? true
    : S extends `${infer H}${infer T}`
      ? H extends '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
        ? Digits<T, readonly [...D, 0]>
        : H extends '-' | '+' | '\n' | '\r' | ' '
          ? false
          : 'unknown'
      : false;
type Line<W extends string> = W extends `--line=${infer V}`
  ? V extends ''
    ? false
    : Digits<V>
  : false;
type Order<
  W extends readonly string[],
  Op extends string,
  Head extends string = '',
  First extends boolean = true,
> = W extends readonly [infer H extends string, ...infer T extends readonly string[]]
  ? OrderChoice<H, T, Op, Head, First>
  : true;
type OrderChoice<
  H extends string,
  T extends readonly string[],
  Op extends string,
  Head extends string,
  First extends boolean,
> = H extends unknown
  ? Opaque<H> extends true
    ? true
    : T extends readonly []
      ? true
      : H extends '--'
        ? T['length'] extends 1
          ? Order<T, Op, Head, false>
          : false
        : Line<H> extends true
          ? First extends true
            ? Op extends 'blame'
              ? Order<T, Op, Head, false>
              : false
            : false
          : H extends `--line=${string}`
            ? Line<H> extends false
              ? Head extends ''
                ? Order<T, Op, H, false>
                : false
              : true
            : Head extends ''
              ? Order<T, Op, H, false>
              : false
  : never;
type CommitWords<W extends readonly string[]> = W extends readonly [
  infer H,
  ...infer T extends readonly string[],
]
  ? H extends '--amend' | '--nocommit' | '--commitmsg'
    ? CommitWords<T>
    : false
  : true;
type Operation<W extends readonly string[], Op extends string, P> = Op extends unknown
  ? OperationChoice<W, Op, P>
  : never;
type OperationChoice<W extends readonly string[], Op extends string, P> = Opaque<Op> extends true
  ? true
  : Op extends 'gui' | 'pick' | 'citool'
    ? Op extends 'pick'
      ? P extends 'path-loop'
        ? false
        : W extends readonly []
          ? true
          : false
      : Op extends 'citool'
        ? CommitWords<W>
        : W extends readonly []
          ? true
          : false
    : Op extends 'browser' | 'blame'
      ? W extends readonly []
        ? false
        : P extends 'positional'
          ? W['length'] extends (Op extends 'browser' ? 1 | 2 | 3 : 1 | 2 | 3 | 4)
            ? Order<W, Op>
            : false
          : true
      : false;
type Script<W extends readonly string[], Program extends string, P, L> = W extends readonly [
  '--help',
  ...unknown[],
]
  ? true
  : W extends readonly ['version' | '--version']
    ? L extends 'direct-tcl'
      ? ScriptBody<W, Program, P, L>
      : true
    : ScriptBody<W, Program, P, L>;
type ScriptBody<W extends readonly string[], Program extends string, P, L> = W extends readonly [
  '--working-dir',
  string,
  ...infer Rest extends readonly string[],
]
  ? L extends 'direct-tcl'
    ? ScriptOperation<Rest, Program, P>
    : L extends 'shell-prelude'
      ? false
      : true
  : ScriptOperation<W, Program, P>;
type ScriptOperation<
  W extends readonly string[],
  Program extends string,
  P,
> = RemoveTrace<W> extends infer T extends readonly string[]
  ? Program extends 'citool'
    ? Operation<T, 'citool', P>
    : T extends readonly [infer Op extends string, ...infer Rest extends readonly string[]]
      ? Operation<Rest, Op, P>
      : true
  : true;
type BadKnownOperation<
  W extends readonly string[],
  Program extends string,
  P,
  L,
> = W extends readonly ['--help', ...unknown[]]
  ? never
  : W extends readonly ['version' | '--version']
    ? L extends 'direct-tcl'
      ? BadMode<W, Program, P>
      : never
    : W extends readonly ['--working-dir', string, ...infer Rest extends readonly string[]]
      ? L extends 'direct-tcl'
        ? BadMode<Rest, Program, P>
        : L extends 'shell-prelude'
          ? true
          : never
      : BadMode<W, Program, P>;
type BadMode<W extends readonly string[], Program extends string, P> = Program extends 'citool'
  ? never
  : W extends readonly [infer H extends string, ...infer Rest extends readonly string[]]
    ? H extends unknown
      ? Opaque<H> extends true
        ? never
        : H extends '--trace'
          ? BadSelectedMode<Rest, P>
          : BadModeWord<H, P>
      : never
    : never;
type BadSelectedMode<W extends readonly string[], P> = W extends readonly [
  infer H extends string,
  ...(readonly string[]),
]
  ? BadModeWord<H, P>
  : never;
type BadModeWord<H extends string, P> = H extends unknown
  ? Opaque<H> extends true
    ? never
    : H extends 'gui' | 'citool' | 'browser' | 'blame'
      ? never
      : H extends 'pick'
        ? P extends 'path-loop'
          ? true
          : never
        : true
  : never;
type BadKnownCount<W extends readonly string[], Program extends string, P> = Program extends 'gui'
  ? W extends readonly [infer Op extends string, ...infer Rest extends readonly string[]]
    ? Op extends 'gui' | 'pick'
      ? Rest['length'] extends 0 | 1
        ? never
        : true
      : Op extends 'browser'
        ? P extends 'positional'
          ? Rest['length'] extends 0 | 1 | 2 | 3 | 4
            ? never
            : true
          : never
        : Op extends 'blame'
          ? P extends 'positional'
            ? Rest['length'] extends 0 | 1 | 2 | 3 | 4 | 5
              ? never
              : true
            : never
          : never
    : never
  : never;
/** Unknown frontend/interpreter or opaque words are not inferred from Git's version. */
export type CheckedGuiArguments<
  S extends { argv: readonly string[] },
  A extends readonly unknown[],
  Ctx extends CommandGrammarContext,
> = Words<A> extends infer W extends readonly string[]
  ? readonly [...S['argv']] extends readonly [
      infer Program extends string,
      ...infer Prefix extends readonly string[],
    ]
    ? readonly [...Prefix, ...W] extends infer All extends readonly string[]
      ? [
          | BadKnownOperation<All, Program, Ctx['guiGrammar'], Ctx['guiLaunch']>
          | BadKnownCount<All, Program, Ctx['guiGrammar']>,
        ] extends [never]
        ? HasOpaque<All> extends true
          ? A
          : Script<All, Program, Ctx['guiGrammar'], Ctx['guiLaunch']> extends true
            ? A
            : never
        : never
      : never
    : never
  : never;
