# Log: tree-branches

- Start: verify showed 0 differences, size passing, ternary and switch `inactive_b` at r1. Work to do.
- Built `plan/branches.ts` on top of `GroupPlanner` (exported from `groups.ts`). Each arm gets a fresh planner and a node.
- Ternary and switch `inactive_b` now r0 on React and Preact. Gate gzip ratio 0.664.
- Removed unused `runBaseline`, `collectInputs` and `findCandidate` from `baseline.ts`.
