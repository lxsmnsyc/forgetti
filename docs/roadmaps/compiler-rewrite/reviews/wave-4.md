# Wave 4: s1-baseline, planner-groups, tree-branches

## Done

All three landed on `batch/compiler-rewrite` after a fresh review.

- `s1-baseline` (`f9befc3`): `compile()` runs phases 1, 2, 3 and 5 with a baseline planner. Two review rounds found soundness gaps (computed keys, computed hook callees, module helpers reading changing bindings or globals). All fixed and checked with probe compiles. 223k tokens.
- `planner-groups` (`59390a2`): S2 planner. Shared input sets, the cheap-expression rule, frozen ownership groups. Total work on React 161 against React Compiler's 162. 267k tokens.
- `tree-branches` (`2385223`): child caches per arm. Inactive-arm re-renders on `ternary` and `switch` fell from 1 to 0, matching proof T2. Total work on React 159. Gzip ratio 0.664. 252k tokens.

## Changed

- New node `fix-control-deps` (must, M, type fix). A block that reads a local assigned inside `if` or `switch` is not keyed on the test, so it goes stale when only the test changes. The `tree-branches` reviewer found it, and the orchestrator reproduced it at `6e36370`. It was already present before `tree-branches`. The soundness gate missed it because no corpus case has this shape, and the unit only compiles when the child component is imported. `tree-loops` now waits for it.
- Accepted edits outside owned paths: `test/next/api.test.ts` (s1-baseline), `emit/index.ts` `wrapJsxRead` (planner-groups), `plan/groups.ts` exports and `take()` (tree-branches), `plan/baseline.ts` reduced to helpers.

## Known gaps (accepted)

- Imported and prop functions are assumed pure, the same as React Compiler. A block with no inputs is computed once per component instance.
- Statements such as `bump()` and loops that build a group run every render. Cross-statement sharing of one input set is not done.

## Notes for the curator

- `pnpm --filter compare gate` has no `--only` flag. The `verify` lines of `s1-baseline`, `planner-groups`, `tree-branches` and `tree-loops` use it, so they always run the work checks and exit 1 until the work thresholds pass. Fix the open briefs, or add the flag to the harness.
- Probe compiles must import the child components. An unknown global makes the unit bail, which hides planner bugs.

## fix-control-deps

- Landed as `64c31da` after one fresh review round and an orchestrator probe check. Blocks now key on `if`, `switch`, ternary and logical tests that guard the writes they read. Writes inside loops, or after a `break`, `continue` or `throw` that can skip them, make the group uncacheable.
- New tuning case `control_assign` (four scenarios). Base plus tuning is now 49 files.
- Total work on React: 166, level with React Compiler's 166. `base/forloop` rose from 14 to 17. `tree-loops` has a note to win it back.

## State for the next session

- Cut 3 (s1-baseline, planner-groups, tree-branches, fix-control-deps) is open as PR #45 for the maintainer. Merge it with a merge commit, then fast-forward the batch branch to `main`.
- Nothing is active.
- Next ready (sequential, take the first): `corpus-heldout`, then `eligibility-writes`, `tree-loops`.
