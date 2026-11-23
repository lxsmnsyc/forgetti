---
milestones: [sound-baseline, grouped-slots, tree-cache, planner, release]
run: sequential
review: auto
merge:
  mode: maintainer
land:
  mode: batch
  every: 5
branches:
budget:
  tokens: 9300000
release:
  publish: changesets
  paths: [packages/**]
  fence: merge
---

# forgetti compiler rewrite

## Outcome

forgetti ships a new compiler built on oxc-parser and magic-string. It replaces the 0.8 Babel compiler. It runs five phases: parse and scope, eligibility, ownership, cache-tree plan, and emit. Its runtime is a `useRef` tree cache that works on React 19 and Preact 11. After `regate` missed on `heldout2`, the planner is changed by census-chosen family rules and judged on a sealed `heldout3` by the hypothesis in `debate-2/debate.md`, with the thresholds of `debate/amendment-1.md`. It matches uncompiled output everywhere, and has fewer re-renders plus recomputes than React Compiler 1.0 in total and on every file. Its size and bailout rate are no worse than React Compiler's.

## Acceptance

- The `gate-3` experiment node passes every threshold in `debate-2/debate.md` on `heldout3` alone and on all sets. A sound, within-size React work miss on `heldout3` still ships, with the miss recorded (debate-2 Q1). A kill criterion stops the roadmap.
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
- About 9k lines are expected (debate P9). Token budget: 3.5M, set by the user on 2026-11-21 from the measured rate of `contracts` (186k for an M node with a fresh review). This overrides the debate's 600k estimate and its 800k kill line, which counted only the code written. Recheck spend against it after `s1-baseline`.
- debate-2 budget: about 1.6M tokens for 6 to 7 nodes (census, harness, `heldout3`, mutation check, up to two family nodes, prune, gate), on top of 6.92M spent and 0.76M for the debate. Budget set to 9.3M.
- At most two family nodes. Each needs 15% of the equal-to-plain steps from the census to start, and stops if it closes less than half its predicted share (debate-2 P18, P21).
- No planner change merges without 0 differences on the corpus and on every mutant of `mutation-check`, React and Preact (debate-2 P15, P19).
- `heldout3` is sealed: only `corpus-heldout-3` and `gate-3` open it.
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
- Inverting the planner default, same-module prop summaries, a grammar-based program generator, and narrow per-file follow-ups from `regate` (debate-2, Rejected).
- Compiling React Server Components.

## Verification

- Fast check (safe in parallel worktrees): `pnpm --filter forgetti test && pnpm lint`
- In a fresh worktree, run `pnpm build` once before `pnpm lint`. Lint is type-aware, and `packages/vite`, `packages/rollup` and the examples resolve `forgetti` types from `packages/forgetti/dist`. Without a build, lint reports errors in those files that are not real. CI already builds first.
- Lint warnings do not fail the check. If a wrapper reports `pnpm lint` as failed with no error lines, check the raw exit code (`rtk proxy pnpm lint`).
- Full check (at checkpoints): `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, then `pnpm --filter compare gate` once the harness exists (about 1 minute, no shared resources).

## Numbered resources

- None.

## Sources

- `debate/debate.md` (approved 2026-11-21), `debate/ledger.json`, `debate/research.md`.
- `debate-2/debate.md` (approved 2026-11-23), `debate-2/ledger.json`.

## Open questions

- Bump level of the `switch` changeset. The changesets rules need the maintainer's approval for a breaking bump. Blocks `switch`.

## Gates

- `contracts` (contract review before anything builds on it).
- `final-gate` (experiment result, missed; see `debate/amendment-1.md`).
- `regate` (experiment result, missed; see `debate-2/debate.md`).
- `gate-3` (experiment result before `switch`).
- `release`.
