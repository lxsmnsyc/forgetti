# Outcome: harness-rc-babel7

## Built

- `benchmarks/compare/src/compilers.ts`: the `react-compiler` cell compiles with `@babel/core` 7 (alias `@babel/core-7`). `lowerJsx` calls `@babel/preset-typescript` without the removed `isTSX` and `allExtensions` options, so `.ts` and `.tsx` siblings load.
- `benchmarks/compare/package.json` and `pnpm-lock.yaml`: devDependency `"@babel/core-7": "npm:@babel/core@^7.29.13"` (resolves 7.29.13).
- `benchmarks/compare/test/rc-babel7.test.ts` (5 tests) and fixture `benchmarks/compare/test/fixtures/multifile/typed/` (default in destructuring, `.tsx` and `.ts` siblings). The fixture is in no corpus set.
- `benchmarks/compare/results/rc-babel7/`: `checks.txt`, `table.txt`, `rc-babel7.md` (comparison with `results/regate/`).

## Proof

- base: `70fd34b`, `pnpm --filter compare exec vitest run test/rc-babel7.test.ts`, new test files only: 3 failed, 2 passed. React Compiler returned `CompileError` for `({ a = 1, b })`. The `.ts` and `.tsx` siblings failed to load: `@babel/preset-typescript: The .allExtensions and .isTSX options have been removed.`
- branch: the same command: 5 passed.

## Result

Not an experiment node. Gate numbers with the fixed React Compiler (`results/rc-babel7/`), reported only:

- React Compiler React work: 723 all sets and 186 on `heldout2`, equal to `regate`. No per-file work number moved.
- Compiled share on held-out files: React Compiler 91/103 (0.883), was 68/132. `heldout2` alone 67/70, was 49/94. next 97/101 and 67/70.
- Gzip ratio next to React Compiler: 0.742 all sets (was 0.804), 0.705 on `heldout2` (was 0.844).
- No threshold changes between pass and miss. Same misses as `regate`.
- next and forgetti 0.8 rows equal `results/regate/checks.txt`.
- React Compiler is sound under Babel 7 on every file but `tuning/callback_globals` (6 steps), as under Babel 8. 0 differences on all of `heldout` and `heldout2`.

## Deviations

- The typed fixture files have `// @ts-nocheck` because `tsconfig.json` (not owned) includes `test/`. The `@babel/core-7` import has a `@ts-expect-error` and a cast, because the alias has no types.
- The brief said `@babel/core@^7.29.0`. The installed range is `^7.29.13`, as pnpm wrote it.

## Stubs left

- None.

## Gotchas

- Only React Compiler uses Babel 7. next and forgetti 0.8 still compile with Babel 8 and `lowerJsx` lowers everything with Babel 8.
- A computed template-literal key still fails React Compiler on both versions.
- The stderr of the gate run is full of React warnings, as before.

## Proposed learnings

- Run React Compiler only under Babel 7 in the harness | 1.0 is built for Babel 7 and under Babel 8 it fails on common syntax, which weakened every earlier gate | benchmarks/compare | yes (`test/rc-babel7.test.ts`)

## Verification

- `pnpm install`, `pnpm build`: pass.
- `pnpm --filter compare test`: 30 passed, 6 skipped (held-out tests need `--set`).
- `pnpm --filter compare typecheck`: pass.
- `pnpm --filter forgetti test` (alone): 25 files, 546 tests pass.
- `rtk proxy pnpm lint`: 0 errors, 13 warnings, none in changed files.
- `pnpm format:check`: pass.
- Gate run on `base tuning heldout heldout2`: exit 1, the regate misses, unchanged.

## Size

- Estimated S, actual S.
