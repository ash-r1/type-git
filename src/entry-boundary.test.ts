/**
 * Entry-point boundary between the lightweight API and `type-git/strict`.
 *
 * The main and runtime entry points must not reach the command grammar catalogue, its
 * types, or the strict command runner, through value or type imports. Otherwise bundles and
 * type checks of applications that never call `strict(...).command()` pay for them again.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = dirname(fileURLToPath(import.meta.url));
const SPECIFIER = /\b(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/**
 * Collect the source files reachable from `entry` through relative value and type imports.
 * Specifiers are expected to name files with a `.js` extension, as everywhere in `src`.
 */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [resolve(src, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      throw new Error(
        `${relative(src, file)} is imported but could not be read; ` +
          'use a relative specifier that names the file with a .js extension',
        { cause: error },
      );
    }
    for (const match of text.matchAll(SPECIFIER)) {
      const target = resolve(dirname(file), (match[1] as string).replace(/\.js$/, '.ts'));
      queue.push(target);
    }
  }
  return new Set([...seen].map((file) => relative(src, file).split('\\').join('/')));
}

const LIGHTWEIGHT_ENTRIES = [
  'index.ts',
  'adapters/node/index.ts',
  'adapters/bun/index.ts',
  'adapters/deno/index.ts',
];

describe('entry-point boundary', () => {
  for (const entry of LIGHTWEIGHT_ENTRIES) {
    it(`${entry} does not reach the command grammar or the strict runner`, () => {
      const files = [...reachable(entry)];
      expect(
        files.filter((file) => file.startsWith('commands/') || file.startsWith('strict/')),
      ).toEqual([]);
      expect(files).toContain('runner/cli-runner.ts');
      // Package self-references would bypass the relative import walk above.
      const selfReferences = files.filter((file) =>
        /\bfrom\s*['"]type-git(?:\/[^'"]*)?['"]|\brequire\(\s*['"]type-git/.test(
          readFileSync(resolve(src, file), 'utf8'),
        ),
      );
      expect(selfReferences).toEqual([]);
    });
  }

  it('strict entry reaches the grammar catalogue and the strict runner', () => {
    const files = reachable('strict/index.ts');
    expect(files.has('commands/generated-data.ts')).toBe(true);
    expect(files.has('strict/command-runner.ts')).toBe(true);
  });

  it('package exports type-git/strict next to the runtime entry points', () => {
    const manifest = JSON.parse(readFileSync(join(src, '../package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(manifest.exports['./strict']).toEqual({
      import: { types: './dist/strict/index.d.ts', default: './dist/strict/index.js' },
      require: { types: './dist/strict/index.d.cts', default: './dist/strict/index.cjs' },
    });
  });
});
