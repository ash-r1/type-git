/**
 * Package subpath exports
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

describe('package exports', () => {
  it('exports type-git/package.json for version checks', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string; exports: Record<string, unknown> };
    expect(manifest.exports['./package.json']).toBe('./package.json');
    // Self-reference resolves through the package's own `exports` map, as consumers do.
    const require = createRequire(import.meta.url);
    expect(require.resolve('type-git/package.json')).toBe(require.resolve('../package.json'));
    expect((require('type-git/package.json') as { version: string }).version).toBe(
      manifest.version,
    );
  });
});
