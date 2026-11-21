import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // `runtime` and `emit` tests render emitted code with React and Preact.
    environment: 'happy-dom',
  },
});
