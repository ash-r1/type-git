import type { ConditionalCommand } from './spec.js';

export type ConditionalCommandPath = {
  ref: string;
  exists: boolean;
} & (
  | { kind: 'return'; exitCode: 0 }
  | {
      kind: 'command';
      command: string;
      argv: readonly string[];
      exitStatus: 'boolean' | 'preserve';
    }
);

/** Enumerate both ref states in a stable order, or select an independently known state. */
export function conditionalCommandPaths(
  specification: ConditionalCommand,
  remaining: readonly string[],
  refExists?: boolean,
): readonly ConditionalCommandPath[] {
  const states = refExists === undefined ? [false, true] : [refExists];
  return states.map((exists): ConditionalCommandPath => {
    const condition = { ref: specification.when.refExists, exists };
    return exists
      ? {
          ...condition,
          kind: 'command',
          command: specification.invoke.command,
          argv: [...specification.invoke.prepend, ...remaining, ...specification.invoke.append],
          exitStatus: specification.invoke.exitStatus,
        }
      : { ...condition, kind: 'return', exitCode: specification.otherwise.exitCode };
  });
}
