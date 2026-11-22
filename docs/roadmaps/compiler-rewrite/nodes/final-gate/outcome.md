# Outcome: final-gate

## Built

- `benchmarks/compare/results/final-gate.md`: every threshold with its measured value, the three readings of the per-file work rule, the compile time comparison with noise, the kill criteria, and the full table (46 files, both targets, all compilers).
- `benchmarks/compare/results/final-gate/checks.txt` (gate output), `table.txt` (harness tables: sizes, slots, compile ms, every scenario step), `analysis.txt` (per-file work in each reading), `time.ts` (the compile time script run by `bench.py`, not wired into the harness).

## Proof

Not a fix node.

## Result

- result: **missed**, against the threshold in `debate/debate.md` "Hypothesis". No kill criterion fired. The roadmap stops here for a new debate.
- Thresholds:
  - 0 differences on every file and both targets: pass (React 0, Preact 0).
  - Total work strictly below each compiler: **miss**. React: next 461, forgetti 0.8 274, React Compiler 500 (below React Compiler, above forgetti 0.8). Preact: next 442, forgetti 0.8 252.
  - No file above the better of the two: **miss**. Strict reading (the hypothesis text): 25 files above on React, 25 on Preact. Excluding steps where forgetti 0.8 renders wrong output: 21 and 21. Excluding forgetti 0.8 as a baseline on any file where it differs: 13 and 12. The miss holds in every reading.
  - Total gzip at most 1.0 times React Compiler: pass (33782 against 43834, 0.771).
  - No file above 1.15 times React Compiler gzip: **miss**. `heldout/tree_view` 1985 against 1634 (1.215).
  - Compiled share at least React Compiler's on held-out files: pass (29 of 31 against 19 of 38).
- Kill criteria: no unfixable difference (0 differences); total gzip 0.771, under 1.3; the 800k spend line is overridden by `GOAL.md` (3.5M budget) and was not judged.
- Compile time (not a threshold): next on oxc 95.31 ms median for 46 files (MAD 1.87), forgetti 0.8 151.2 ms (1.59 times, MAD 4.08), React Compiler 271.1 ms (2.84 times, MAD 7.14). Faster than both beyond the noise (perf-pass `bench.py`, 10 runs, 2 warmup).
- `heldout/hex_input` rows are marked seen, so only 9 held-out files are unexposed (the metric asks for at least 10). They add no work, and gzip results do not change without them. Excluding `hex_input`, the compiled share is 26 of 28 against 18 of 34: still a pass.
- Failing files (work, strict reading, React and Preact): `base/bailout`, `base/callback`, `base/forloop`, `base/hook`, `base/jsxprops`, `base/mutate`, `base/trycatch`, `tuning/alias_branch`, `tuning/alias_closure`, `tuning/alias_field`, `tuning/alias_push`, `tuning/alias_spread`, `tuning/alias_unknown`, `tuning/hook_nested`, `tuning/hook_object`, `tuning/loop_shapes`, `tuning/throw_boundary_swap`, `tuning/throw_call`, `tuning/throw_group`, `heldout/cart_summary`, `heldout/dashboard_card`, `heldout/form_validation`, `heldout/list_filters`, `heldout/table_sort`, `heldout/tree_view`. Size: `heldout/tree_view`.
- reproduce: commit `987e99a`, `pnpm install && pnpm build && pnpm --filter compare gate --set base --set tuning --set heldout`, Node 26.12.1, macOS, 8 cores, 8 GB RAM. Counts and gzip bytes are deterministic; two full runs gave equal totals.

Proposed follow-up nodes, for the new debate to weigh (one line each):

- `heldout-stable-children`: children re-render on steps with unchanged inputs; `heldout/cart_summary` (r3 on `same`, 54 against React Compiler 24), `heldout/dashboard_card` (32 against 12).
- `escaping-closure-bailout`: `SignupForm` bails as `escaping-closure` and runs uncompiled; `heldout/form_validation` (72 against 25).
- `memo-child-props`: memo children re-render on edits where forgetti 0.8 skips them; `heldout/tree_view`, `heldout/list_filters`, `heldout/table_sort` (`sorting/by_age` r19 against r7).
- `hook-result-cache`: work equals React Compiler and is above forgetti 0.8 (sound there); `base/hook`, `tuning/hook_nested`, `tuning/hook_object`.
- `callbacks-and-props`: above both sound baselines; `base/callback`, `base/jsxprops`, `base/mutate`, `base/trycatch`.
- `alias-rows`: above forgetti 0.8 on steps where it is sound; `tuning/alias_branch`, `tuning/alias_closure`, `tuning/alias_field`, `tuning/alias_push`, `tuning/alias_spread`, `tuning/alias_unknown`, `base/forloop`, `tuning/loop_shapes`.
- `tree-view-size`: gzip 1.215 times React Compiler; `heldout/tree_view`.
- `per-file-threshold-wording`: the strict rule compares against forgetti 0.8 rows it renders wrongly (`base/forloop` 0, `tuning/alias_*` 0, `tuning/throw_*`, `base/bailout`), which no sound compiler can reach; the new debate should decide whether DIFF rows count.

## Deviations

- None in compiler code, corpus or harness source. Throwaway scripts in `benchmarks/compare/*.tmp.*` (a `collect()` dump and the DIFF-reading analysis) were used and deleted; only their outputs are committed. The timing script is kept as `benchmarks/compare/results/final-gate/time.ts` (import paths adjusted to its folder; a rerun gave 95.32 ms for next).
- The brief's `verify` line uses `--set base,tuning,heldout`; I ran the repeated form `--set base --set tuning --set heldout`, which `cli.ts` treats the same.

## Stubs left

- None.

## Gotchas

- The compiled share compares different unit counts: the new compiler counts components and hooks (31 held-out units), React Compiler counts one logger event per function it tried (38).
- The new compiler's compile time is measured from TypeScript source through Vite SSR, as the gate loads it, not from a built bundle.
- forgetti 0.8 differs on 18 files on React and 17 on Preact, so its work totals include wrong renders.

## Proposed learnings

- A per-file work threshold must say whether a baseline's wrong-output rows count | forgetti 0.8 reports 0 work on rows it renders wrongly, which no sound compiler can match | docs/roadmaps | no

## Verification

- `pnpm build`: pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout`: exit 1 (thresholds missed, as reported).
- perf-pass `bench.py --runs 10 --warmup 2`: see Result.

## Size

- Estimated M, actual M.
