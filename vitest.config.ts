import process from 'node:process';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Native Git/Perl/LFS process chains need time on hosted Windows workers.
    ...(process.platform === 'win32'
      ? { fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 }
      : {}),
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/bun/**',
      'test/deno/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        'src/adapters/bun/**',
        'src/adapters/deno/**',
      ],
    },
  },
});
