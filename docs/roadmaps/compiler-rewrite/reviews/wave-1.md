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
- PR #41 (`fix/ignore-docs-in-lint`) makes lint and format skip `docs/**`. Until it merges, `pnpm lint` and `pnpm format:check` fail on `main` and on the batch because of `docs/roadmaps/compiler-rewrite/debate/evidence/`. Merge `origin/main` into the batch after #41 lands.
- Next ready (sequential, take the first): `harness`, then `emit`, `parse-scope`, `eligibility`, `runtime`, `ownership`.
- Gotcha from `contracts`: run `pnpm build` before `pnpm lint`. The plugins and examples import the built `forgetti` types.
- Gotcha: do not run `pnpm format` on the whole repo before #41 lands. It rewrites `docs/`.
- Open: the Release workflow fails until "Allow GitHub Actions to create and approve pull requests" is on. The bump level of `switch` is still open (GOAL.md).
