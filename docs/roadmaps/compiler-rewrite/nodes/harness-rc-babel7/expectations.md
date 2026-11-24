# Reviewer expectations: harness-rc-babel7

Written before seeing the change, from the brief, base `compilers.ts` and `results/regate/checks.txt`.

## What a correct change does

1. Adds `@babel/core` 7 as a pinned devDependency alias in `benchmarks/compare/package.json`, for example `"@babel/core-7": "npm:@babel/core@7.29.x"`. The exact version is pinned, with no `^` or `~` range, so the numbers can be reproduced. `pnpm-lock.yaml` changes only to add that alias and its dependency tree.
2. In `compilers.ts`, only the `react-compiler` branch of `compileOnce` runs through Babel 7. `forgetti-0.8` still runs through `@babel/core` 8 by the same `runBabel` call with the same options. `plain` and `next` stay as they are. The likely shape is a `runBabel` that takes the Babel module as a parameter, or a second wrapper for Babel 7. Both must pass the same options (filename, `configFile: false`, `babelrc: false`, parser plugins by extension).
3. The timing loop in `compileSource` also uses Babel 7 for React Compiler, so `ms` measures the same pipeline as the output.
4. `lowerJsx` loads TS siblings. It drops `isTSX` and `allExtensions` from the `@babel/preset-typescript` 8 options, or uses an option set that Babel 8 accepts. Whatever the fix, `.tsx` must still keep JSX working and `.ts` must still reject JSX, or the change must explain why not. `lowerJsx` may stay on Babel 8, since it runs after compilation for every cell. Moving it to Babel 7 for only one cell would make the cells unequal.
5. Tests under `benchmarks/compare/test/`:
   - A test compiles a component with `({ a = 1, b }) => ...` (or `function C({ a = 1 })`) through the React Compiler cell and checks for a `CompileSuccess` result: `compiled >= 1`, no `CompileError` in bailouts, and `_c(` in the output. A test that only checks "does not throw" is too weak, because `panicThreshold: 'none'` never throws.
   - A multi-file fixture case with a `.ts` or `.tsx` sibling goes through `compileCase` and `lowerJsx` (the path the gate takes), not only `compileSource`. The fixture lives under `test/` and not in any corpus set.
   - If possible, a test shows the Babel 7 instance is the one in use, for example the compiled destructuring default failing on Babel 8 and passing on 7, or a check of `version`.
6. `results/rc-babel7/` holds a gate table and `checks.txt` for `base`, `tuning`, `heldout`, `heldout2`, made by the existing gate scripts, beside the `regate` numbers for React work, compiled share and gzip, for all sets and for `heldout2` alone. The planner is not judged here.
7. `pnpm --filter compare test` passes. Lint and typecheck pass for `benchmarks/compare`.

## What I will check

- `git diff` touches only owned paths: `benchmarks/compare/src/compilers.ts`, `package.json`, `test/**`, `results/rc-babel7/**`, `pnpm-lock.yaml`, plus the node folder. Nothing in `packages/` and nothing under `benchmarks/corpus/`.
- No reference to `heldout3` in the diff, the scripts run, the logs or the results. `results/rc-babel7/` covers exactly the four allowed sets.
- The lockfile resolves `@babel/core-7` to a single 7.x version, and React Compiler's peer resolves without breaking the Babel 8 cells. `forgetti-0.8` still gets Babel 8.
- I run `pnpm --filter compare test` myself.
- I check the destructuring-default test fails if the React Compiler call is pointed back at Babel 8. I check by reading the code and, if cheap, a scratch run outside the repo tree, not by editing repo code.
- Next and forgetti 0.8 numbers in `results/rc-babel7/checks.txt` match `results/regate/checks.txt` line by line. That covers soundness, next totals (633 react, 611 preact), next gzip totals (57875 all sets, 20659 heldout2), next compiled share (97/101, 67/70), forgetti totals (359, 337), forgetti wrong-step lists and per-file next and forgetti counts. Timing may differ; nothing else may.
- React Compiler compiled counts move the way the brief measured: `base` 14 stays 14, `tuning` 54 stays 54, `heldout` 19 becomes about 24, `heldout2` 49 becomes about 67. On the gate's units (per file, from the logger) this should show in the compiled share: today `react-compiler 68/132` all sets and `49/94` heldout2. If numbers move on `base` or `tuning`, the change did more than swap Babel.
- React Compiler soundness: the fixed React Compiler must still pass the soundness checks, or the report must name each new difference. A stronger React Compiler can memoize more and expose a harness or runtime gap.
- The "replaced by uncompiled counts" INFO line (tuning/callback_globals) is still handled, or its change is explained.
- The outcome reports the new numbers as information and does not claim the planner passes or fails.

## Failure modes

- Babel 7 used for every cell, which moves the forgetti 0.8 numbers or the shared parse step.
- Babel 7 used only for the first compile and not for the 20 timing runs, or the reverse.
- The React Compiler plugin still gets Babel 8's `types` through a shared import or a hoisted dependency, so the swap has no effect. Symptom: `heldout2` compiled count stays at 49.
- A version range instead of a pin, or a lockfile that also bumps unrelated packages.
- The TS fix only removes options and breaks `.tsx` JSX handling, or the multi-file test uses a `.ts` sibling with no types, so it would pass without the fix.
- The destructuring test asserts only that the call returns, which passes under Babel 8 too.
- Results produced by a different script or flags than `regate`, so the comparison is not like for like.
- Gate output for `heldout3`, or any file read from `benchmarks/corpus/heldout3/`.
- Edits to `packages/`, contracts, other briefs or `status` fields.
- Result files edited by hand instead of regenerated by the scripts.
