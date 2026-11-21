import config from '@lxsmnsyc/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [config],
  ignorePatterns: [
    'dist/**',
    'benchmarks/**',
    // Agent worktrees under .claude/ hold other branches' work in progress.
    '.claude/**',
    // Scratch files for trying the compiler by hand (`pnpm optimize`).
    'packages/forgetti/example.js',
    'packages/forgetti/input.js',
    'packages/forgetti/output.js',
  ],
  overrides: [
    {
      // The stubs of later nodes hold one named export each.
      files: ['packages/forgetti/src/next/**'],
      rules: { 'import/prefer-default-export': 'off' },
    },
    {
      // The 0.8 compiler predates these rules. The compiler rewrite replaces this
      // folder, so it is exempt until then instead of being fixed twice.
      files: ['packages/forgetti/src/core/**', 'packages/forgetti/src/index.ts'],
      rules: {
        'no-multi-assign': 'off',
        'import/prefer-default-export': 'off',
        'typescript/explicit-function-return-type': 'off',
        'typescript/no-unnecessary-condition': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
        'typescript/prefer-nullish-coalescing': 'off',
        'typescript/switch-exhaustiveness-check': 'off',
      },
    },
  ],
});
