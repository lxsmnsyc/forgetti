import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Compiling and running the corpus on four compilers takes several seconds.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
