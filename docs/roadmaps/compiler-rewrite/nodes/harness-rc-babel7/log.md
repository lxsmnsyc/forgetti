# Log: harness-rc-babel7

- Branch `fix/harness-rc-babel7`, reset to `batch/compiler-rewrite` at `70fd34b`.
- Proof on the base: wrote `test/rc-babel7.test.ts` and the fixture `test/fixtures/multifile/typed/` (input with `{ a = 1, b }`, siblings `chip.tsx` and `scale.ts`). Command `pnpm --filter compare exec vitest run test/rc-babel7.test.ts` at `70fd34b` with the new files only: 3 of 5 failed. React Compiler gave `CompileError` for the default in destructuring, and the plain cell failed with `@babel/preset-typescript: The .allExtensions and .isTSX options have been removed.`
- Fix: `@babel/core-7` alias devDependency (`npm:@babel/core@^7.29.13`, resolves 7.29.13), `runBabel` takes the Babel core, only the React Compiler call passes `babel7`. `lowerJsx` uses the preset without options (Babel 8 reads the extension).
- The alias has no types: `@ts-expect-error` on the import and a cast to `typeof babel`. `tsconfig.json` is not owned, so the typed fixture files carry `// @ts-nocheck` (their counter import resolves only after relinking).
- Gate run: `pnpm --filter compare exec node results/regate/save.ts results/rc-babel7 base tuning heldout heldout2`. Exit 1 (regate misses, unchanged). Only React Compiler gzip and compiled-share lines changed against `results/regate/checks.txt`.
- No heldout3 file was opened or compiled.
