# Wave 2: harness, emit, parse-scope, corpus-tuning

## Done

All four landed on `batch/compiler-rewrite` after a fresh review. Each has a `spent:` field in its brief.

- `harness` (`96e1e81`): `benchmarks/compare`. Freezes `corpus-format`. 216k tokens.
- `emit` (`d03b180`): phase 5. 313k tokens.
- `parse-scope` (`554eee0`): phase 1. Needed two review rounds for default parameter scopes. 274k tokens.
- `corpus-tuning` (`7216a49`): 19 tuning cases. Needed two review rounds so the throw cases keep their cache. 223k tokens.

## Changed

- `phase-ir` v2: outputs are read from their value slot, not a `let` local (`emit` change request).
- `phase-ir` v3: scope 0 is `module`, and JSX tag names are references (`parse-scope` change request).
- `compiler-api` note: skip comments follow where users put them, and `use2` is a hook. Both differ from 0.8.
- Notes from `emit` and `parse-scope` added to the briefs of `eligibility`, `ownership`, `s1-baseline`, `planner-groups`, `tree-branches` and `tree-loops`.
- `corpus-tuning` `verify` fixed to `pnpm --filter compare test`.
- New node `harness-timeout` (should, S): forgetti 0.8 hangs on props mutated in place, and the harness has no timeout.

## Budget

1.21M of 3.5M tokens spent on 5 nodes. At about 242k per node the forecast is 4.85M, over the budget. Recheck after `s1-baseline` as planned, or cut scope.

## State for the next session

- Cut 1 is open as PR #43 (`batch/compiler-rewrite` into `main`), for the maintainer. The batch branch keeps going from the same commit. Push new batch commits to it only after #43 merges, or they join that PR.
- Nothing is active.
- Next ready (sequential, take the first): `runtime`, then `eligibility`, `ownership`, `corpus-heldout`, `harness-timeout`.
- Open: the bump level of `switch` (GOAL.md).
