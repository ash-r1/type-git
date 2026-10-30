import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { commandSpecs, decodeCommandSpecs } from './catalogue.js';
import { COMMAND_SPECS } from './generated.js';
import { COMMAND_SPECS_DATA } from './generated-data.js';

// Value imports of generated.js would bundle the multi-megabyte literal again.
const VALUE_IMPORT = /^import\s+\{[^}]*\}\s+from\s+'[./]*(commands\/)?generated\.js';/m;

describe('compact command catalogue', () => {
  it('decodes to the same values as the typed literal catalogue', () => {
    expect(decodeCommandSpecs(COMMAND_SPECS_DATA)).toStrictEqual(COMMAND_SPECS);
  });

  it('decodes once and reuses the result', () => {
    expect(commandSpecs()).toBe(commandSpecs());
  });

  it('shares repeated subtrees instead of copying them', () => {
    expect(decodeCommandSpecs('[[{"x":[1,2]}],{"a":{"@":0},"b":[{"@":0}]}]')).toStrictEqual({
      a: { x: [1, 2] },
      b: [{ x: [1, 2] }],
    });
    const decoded = decodeCommandSpecs('[[{"x":1}],{"a":{"@":0},"b":{"@":0}}]') as unknown as {
      a: unknown;
      b: unknown;
    };
    expect(decoded.a).toBe(decoded.b);
  });

  it('keeps the literal catalogue out of runtime imports', () => {
    const offenders: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(path);
        } else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) {
          if (VALUE_IMPORT.test(readFileSync(path, 'utf8'))) {
            offenders.push(path);
          }
        }
      }
    };
    visit(join(dirname(fileURLToPath(import.meta.url)), '..'));
    expect(offenders).toStrictEqual([]);
  });
});
