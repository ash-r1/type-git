// Runtime access to the generated command catalogue.
//
// src/commands/generated.ts holds the catalogue as an `as const` literal so the
// type-level grammar keeps its precise shape; runtime code must only import it
// with `import type`. The runtime copy is a compact JSON string (generated-data.ts)
// that is parsed on the first typed-command call instead of at module load, so
// importing the package without using typed commands does not pay for it.

import type { COMMAND_SPECS } from './generated.js';
import { COMMAND_SPECS_DATA } from './generated-data.js';

/** Runtime shape of the generated command catalogue. */
export type CommandSpecs = typeof COMMAND_SPECS;

const REFERENCE = '@';
let decoded: CommandSpecs | undefined;

/** Replace {"@": index} subtree references with the shared table entries. */
function resolve(node: unknown, table: readonly unknown[]): unknown {
  if (node === null || typeof node !== 'object') {
    return node;
  }
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index++) {
      node[index] = resolve(node[index], table);
    }
    return node;
  }
  const record = node as Record<string, unknown>;
  const reference = record[REFERENCE];
  if (typeof reference === 'number') {
    return table[reference];
  }
  for (const key of Object.keys(record)) {
    record[key] = resolve(record[key], table);
  }
  return record;
}

/** Decode the compact catalogue; each table entry refers only to earlier entries. */
export function decodeCommandSpecs(data: string): CommandSpecs {
  const [table, root] = JSON.parse(data) as [unknown[], unknown];
  for (let index = 0; index < table.length; index++) {
    table[index] = resolve(table[index], table);
  }
  return resolve(root, table) as CommandSpecs;
}

/** Return the command catalogue, decoding it once on first use. */
export function commandSpecs(): CommandSpecs {
  decoded ??= decodeCommandSpecs(COMMAND_SPECS_DATA);
  return decoded;
}
