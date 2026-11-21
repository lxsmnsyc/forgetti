import { defineConfig } from 'tsdown';

const shared = {
  entry: { index: 'src/index.ts', runtime: 'runtime/index.ts' },
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'es2018',
  sourcemap: true,
  fixedExtension: false,
  cjsDefault: false,
} as const;

export default defineConfig([
  // Production build. `import.meta.env.DEV` becomes `false` so the display names drop out.
  {
    ...shared,
    dts: true,
    define: { 'import.meta.env.DEV': 'false' },
  },
  // Development build of the runtime, served under the `development` condition.
  {
    ...shared,
    entry: { runtime: 'runtime/index.ts' },
    outDir: 'dist/development',
    clean: false,
    dts: false,
    define: { 'import.meta.env.DEV': 'true' },
  },
]);
