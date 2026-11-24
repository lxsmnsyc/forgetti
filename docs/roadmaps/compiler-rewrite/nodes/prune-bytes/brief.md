---
id: prune-bytes
title: Per-unit byte check in the prune pass
status: todo
priority: must
type: feature
milestone: planner
size: S
added: 2026-11-23
verify: pnpm --filter forgetti test && pnpm --filter compare mutate
owns:
  - packages/forgetti/src/next/plan/cost.ts
  - packages/forgetti/test/**
depends_on:
  - on: family-2
    kind: hard
    why: measures the blocks the family nodes add; same planner files
---

# Per-unit byte check in the prune pass

## Goal

Keep the prune pass rule in `plan/cost.ts` and add a per-unit byte check, so new cache blocks that save no child render are dropped first when a unit grows past React Compiler's size (debate-2 P6). `heldout/tree_view` has 4% left under the per-file cap (O7).

## Acceptance

- [ ] No file above 1.15 times React Compiler gzip on the development sets, total at most 1.0.
- [ ] Work on the development sets does not rise.
- [ ] 0 differences on the corpus and every mutant.

## Notes for the worker

- Never open `benchmarks/corpus/heldout3/`.
- If the family nodes left every file under the cap, record that and keep the change minimal.
