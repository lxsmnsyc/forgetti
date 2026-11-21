import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  // Roadmaps, debates and their evidence are not build inputs, and CI skips docs-only changes.
  ignorePatterns: ['docs/**'],
});
