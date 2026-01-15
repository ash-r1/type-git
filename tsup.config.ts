import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/node/index': 'src/adapters/node/index.ts',
    'adapters/bun/index': 'src/adapters/bun/index.ts',
    'adapters/deno/index': 'src/adapters/deno/index.ts',
    // Backend entry points
    'backends/cli/index': 'src/backends/cli/index.ts',
    'backends/isomorphic-git/index': 'src/backends/isomorphic-git/index.ts',
    'backends/nodegit/index': 'src/backends/nodegit/index.ts',
    'backends/wasm-git/index': 'src/backends/wasm-git/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
