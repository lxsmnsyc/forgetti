# Wave 6 (sequential, 2026-11-24)

## tree-loops

- Landed as `79f4e6b` after one fresh review round. Each loop iteration and `.map` call gets a child cache by position; result arrays are wrapped in `keep()`.
- The review found a soundness bug: a `var` declared in a loop header was treated as a fresh binding per iteration, so closures in cached rows kept stale values. Fixed: `var` header bindings are never plain inputs. New scenarios in `tuning/loop_shapes`.
- Gate on `base` and `tuning`: 0 differences on React and Preact. Total work on React 140 without `loop_shapes` (was 166; React Compiler 166), 163 with it (React Compiler 218). `base/forloop` 17 to 11. Gzip ratio 0.681.
- Memory: about 81 bytes of cache per row, 82 KB per 1,000 rows (measured with a script mirroring the emitted calls, not a React render).
- Positional caches lost no measured row to React Compiler, so `keyed-iterations` stays `later`.

## Changed

- `final-gate` brief: notes on nested `var` loops that differ for every compiler, and on the weak `var_counter` scenarios.
- Accepted edit outside owned paths: `plan/baseline.ts` (`Context.perIteration`), and the corpus case `tuning/loop_shapes`.

## State for the next session

- Nothing is active. The batch carries corpus-heldout, eligibility-writes and tree-loops (local only, worktree `../forgetti-batch`).
- Next ready (sequential, take the first): `final-gate` (must, experiment, gated: the user sees the result before anything builds on it), then `eligibility-store-gaps`, `harness-timeout`, `runtime-test-speed`.
- Cut 4 (3 nodes) is due. It needs the full check on the batch, then one pull request for the maintainer.
