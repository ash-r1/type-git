import { join } from 'node:path';
import { defineConfig } from 'tsup';

const declarations = process.env.TYPE_GIT_DECLARATIONS_DIR;

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/node/index': 'src/adapters/node/index.ts',
    'adapters/bun/index': 'src/adapters/bun/index.ts',
    'adapters/deno/index': 'src/adapters/deno/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: declarations
    ? { entry: {
        index: join(declarations, 'index.d.ts'),
        'adapters/node/index': join(declarations, 'adapters/node/index.d.ts'),
        'adapters/bun/index': join(declarations, 'adapters/bun/index.d.ts'),
        'adapters/deno/index': join(declarations, 'adapters/deno/index.d.ts'),
      } }
    : true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
