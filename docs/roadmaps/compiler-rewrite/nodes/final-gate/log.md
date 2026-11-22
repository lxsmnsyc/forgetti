# Log: final-gate

- Branch renamed to `experiment/final-gate`, reset to `batch/compiler-rewrite` (`987e99a`). `pnpm install`, `pnpm build`: pass.
- Gate `--set base --set tuning --set heldout`: exit 1. Soundness 0 differences on both targets. Work misses against forgetti 0.8 on both targets. Gzip total 0.771 passes, `heldout/tree_view` 1.215 misses the per-file limit. Compiled share 29/31 against 19/38 passes.
- Collected the same results again through `collect()` with a throwaway script, to get per-step data for the DIFF readings and the full table. Totals match the gate run exactly (461/274/500, 442/252).
- Per-file work: strict 25 files above on React and Preact; step-excluded 21 and 21; file-excluded 13 and 12. All readings miss.
- No held-out file has a `for (var` loop, so the `tree-loops` warning does not apply.
- Compile time with perf-pass `bench.py`, 10 runs plus 2 warmup, sum of per-file medians over 46 files: next 95.31 ms (MAD 1.87), forgetti 0.8 151.2 (4.08), React Compiler 271.1 (7.14). Next is faster beyond noise.
- Throwaway scripts (collect dump, analysis, timing) lived in `benchmarks/compare/*.tmp.*` and were deleted. Outputs kept in `benchmarks/compare/results/final-gate/`.
- Verdict: missed. No kill criterion fired; the 800k spend line is overridden by `GOAL.md`.
- Review fixes: Preact denominator 43, `dashboard_card` excess split (12 renders plus 8 recomputes), `hex_input` exposure tied to the held-out count (share without it 26/28 against 18/34), timing script restored as `results/final-gate/time.ts`.
