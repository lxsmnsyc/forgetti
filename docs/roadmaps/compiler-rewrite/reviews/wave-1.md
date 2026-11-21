# Wave 1: contracts

## Done

- `contracts` landed on `batch/compiler-rewrite` as `d39d055`. `compiler-api`, `runtime-api` and `phase-ir` are frozen at v1. The user approved them on 2026-11-21.
- Spent 185,582 tokens: 115k worker, 70k fresh review.

## Changed

- Token budget raised to 3.5M by the user (GOAL.md, debate P9 overruled). Recheck after `s1-baseline`.
- The contracts clarify the branch `at` rule, nested outputs, slot counting and parse error format. See each contract's "Changes".
- `contracts` added stub files `src/next/plan/{baseline,groups,branches,loops}.ts`, one per planner node, outside its owned paths. Each later planner node owns its file.

## State for the next session

- Batch branch `batch/compiler-rewrite` is local only, in the worktree `.worktrees/batch-compiler-rewrite`. It carries 1 node. Nothing is cut yet.
- PR #41 merged on 2026-11-21. Lint and format skip `docs/**`, and `main` is merged into the batch (`8a0c116`). Lint, format and typecheck pass there.
- Next ready (sequential, take the first): `harness`, then `emit`, `parse-scope`, `eligibility`, `runtime`, `ownership`.
- Gotcha from `contracts`: run `pnpm build` before `pnpm lint`. The plugins and examples import the built `forgetti` types.
- Open: the Release workflow fails until "Allow GitHub Actions to create and approve pull requests" is on. The bump level of `switch` is still open (GOAL.md).
