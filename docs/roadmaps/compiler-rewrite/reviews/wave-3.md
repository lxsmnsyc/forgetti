# Wave 3: eligibility, runtime, ownership

## Done

All three landed on `batch/compiler-rewrite` after a fresh review.

- `eligibility` (`058a6c6`): phase 2. Bails on nested writes to props, state and hook arguments, and on `Object.assign` targets. 333k tokens.
- `runtime` (`cf87d76`): `useCache`, `branch`, `keep`, 387 bytes minified. React and Preact matrix tests. 324k tokens.
- `ownership` (`ff48f13`): phase 3. Spread copies of fresh values join the group; closures that change captured values bail when they escape; callbacks that are not inline count as mutations. 1.14M tokens over 4 fix rounds.

## Changed

- `phase-ir` v4: `OwnershipResult.bailout` (`ownership` change request, accepted). `planner-groups` moves the field into `ir.ts` and wires the bailout; it now lists `ir.ts` and `ownership/index.ts` as shared.
- New node `eligibility-writes` (must, M): writes to hook results, instances kept in state, nested writes through spread copies of props. `final-gate` now waits for it.
- New node `runtime-test-speed` (should, S): the forgetti test run takes about 85 s; target under 40 s.
- GOAL.md Verification: run `pnpm build` before `pnpm lint` in a fresh worktree. The rtk wrapper misreports `pnpm lint` as failed; check with `rtk proxy pnpm lint`.
- The maintainer said not to raise token budget warnings for this roadmap.
- New nested rules: `packages/forgetti/runtime/CLAUDE.md`, `packages/forgetti/test/next/CLAUDE.md`.

## Known gaps (accepted)

- `eligibility`: hooks returning a fresh value bail only when a closure later changes it (maintainer agreed to the narrow reading).
- `ownership`: `() => mutate(items)` in a handler is not counted as a change; a named read-only callback (`items.forEach(show)`) bails.

## State for the next session

- Cut 2 (eligibility, runtime, ownership) is open as PR #44 for the maintainer. Merge it with a merge commit, then merge `main` back into the batch branch.
- Nothing is active.
- Next ready (sequential, take the first): run `plan.py ready`. Expected: `s1-baseline`, `corpus-heldout`, `eligibility-writes`, `harness-timeout`, `runtime-test-speed`.
