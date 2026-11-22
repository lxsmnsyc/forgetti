# Wave 5 (sequential, 2026-11-24)

## corpus-heldout

- Landed as `6a6af21`. Ten held-out cases in `benchmarks/corpus/heldout/`: seven written fresh in the shape of MIT sources (`derived: true`), three near-verbatim from react-colorful and react-otp-input (`derived: false`).
- `pnpm --filter compare test --set heldout` runs them; plain runs skip them. The wrapper is `benchmarks/compare/src/test.ts`.

## eligibility-writes

- Landed as `92b6244` after five fresh review rounds. Phase 2 now has one value classifier (`findDerived`: fresh, copy or watched) for locals at every depth, reassignments, store targets and every write root.
- Kept state instances (`useState(() => new Store())` then `store.add`) still bail, recorded as a known false bailout.
- The 35 base and tuning files keep their eligibility results. 488 forgetti tests pass.

## Added

- `eligibility-store-gaps` (should, S): rare store and alias forms the review did not block on, plus the clone-then-mutate false bailout.

## State for the next session

- Nothing is active. The batch `batch/compiler-rewrite` (worktree `../forgetti-batch`, local only) carries corpus-heldout and eligibility-writes. Cut when it holds about five nodes, or before `final-gate` needs it on `main`.
- Next ready (sequential, take the first): `tree-loops`, then `eligibility-store-gaps`, `harness-timeout`, `runtime-test-speed`.
