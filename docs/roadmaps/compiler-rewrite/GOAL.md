---
milestones: [sound-baseline, grouped-slots, tree-cache, release]
run: sequential
review: auto
merge:
  mode: maintainer
land:
  mode: batch
  every: 5
branches:
budget:
  tokens: 800000
release:
  publish: changesets
  paths: [packages/**]
  fence: merge
---

# forgetti compiler rewrite

## Outcome

forgetti ships a new compiler built on oxc-parser and magic-string. It replaces the 0.8 Babel compiler. It runs five phases: parse and scope, eligibility, ownership, cache-tree plan, and emit. Its runtime is a `useRef` tree cache that works on React 19 and Preact 11. On the grown corpus it meets the hypothesis in `debate/debate.md`. It matches uncompiled output everywhere, and has fewer re-renders plus recomputes than forgetti 0.8 and React Compiler 1.0. Its size and bailout rate are no worse than React Compiler's.

## Acceptance

- The `final-gate` experiment node passes every threshold in `debate/debate.md` "Hypothesis".
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm test` pass.
- `vite-plugin-forgetti` and `rollup-plugin-forgetti` compile with the new compiler and no longer depend on `@babel/core`.

## Priorities

- must: needed to reach the hypothesis gate and ship the new compiler.
- should: none yet.
- could: compile-time tuning.
- later: keyed iteration caches (only if a measured row fails, see `debate/debate.md` A2).

## Constraints

- Starts after PR #39 (`chore/repo-setup`) merges. Every `verify` command assumes its tsdown, vitest 5, oxlint and changesets setup.
- One worktree at a time. The machine has 8 GB RAM and 8 cores and is CPU-bound (debate J1).
- About 9k lines and 600k tokens are expected. 800k tokens before `final-gate` is a kill criterion (debate P9).
- Soundness is a hard gate on every milestone: 0 differences from uncompiled output (debate P3, P8, P17).
- The new compiler lives in `packages/forgetti/src/next/` and its runtime in `packages/forgetti/runtime/next.ts`. Neither is exported until `switch`, so the 0.8 compiler keeps working and every node merges alone.
- `packages/forgetti/src/next/index.ts` (the `compile()` pipeline) and `packages/forgetti/src/next/plan/index.ts` (the planner pass list) are touched by several nodes on purpose. They are short wiring files; each node adds one call or one entry and keeps its logic in its own folder. `packages/forgetti/src/next/plan/index.ts` is the planner pass list. It is already split by feature: each planner node owns its pass file and appends one line to the list, so the five nodes that touch it only add one line each.
- Never import from `react/compiler-runtime`. The runtime takes the `useRef` hook as an argument so one runtime serves React and Preact.
- Every slot computes its value into a local first, then writes inputs and value together (debate J13).
- Follow the agent-skills `ts-style` rules. Do not read React Compiler's source. It may only be run as a black box through the harness.

## Non-goals

- A Babel plugin entry point (debate J8, the toolchain choice).
- A control-flow-graph IR or reactive scopes modeled on React Compiler (debate J8, J10).
- Outlined JSX memo components (debate P5).
- Keyed iteration caches by default (debate O7, A2).
- Compiling React Server Components.

## Verification

- Fast check (safe in parallel worktrees): `pnpm --filter forgetti test && pnpm lint`
- Full check (at checkpoints): `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, then `pnpm --filter compare gate` once the harness exists (about 1 minute, no shared resources).

## Numbered resources

- None.

## Sources

- `debate/debate.md` (approved 2026-11-21), `debate/ledger.json`, `debate/research.md`.

## Open questions

- Bump level of the `switch` changeset. The changesets rules need the maintainer's approval for a breaking bump. Blocks `switch`.

## Gates

- `contracts` (contract review before anything builds on it).
- `final-gate` (experiment result before `switch`).
- `release`.
