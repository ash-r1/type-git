import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/node/index': 'src/adapters/node/index.ts',
    'adapters/bun/index': 'src/adapters/bun/index.ts',
    'adapters/deno/index': 'src/adapters/deno/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
