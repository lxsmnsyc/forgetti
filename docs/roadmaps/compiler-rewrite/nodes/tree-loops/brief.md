---
id: tree-loops
title: S3: positional iteration caches and keep()
status: todo
priority: must
type: feature
milestone: tree-cache
size: M
verify: pnpm --filter compare gate --set base,tuning --only soundness,size
owns:
  - packages/forgetti/src/next/plan/loops.ts
  - packages/forgetti/test/next/plan/loops/**
shared:
  - packages/forgetti/src/next/plan/index.ts
depends_on:
  - on: planner-groups
    kind: hard
    why: iteration nodes hold the grouped slot blocks
  - on: tree-branches
    kind: hard
    why: both passes rewrite the same CachePlan tree; nested `.map` inside a branch needs the branch pass first
---

# S3: positional iteration caches and keep()

## Goal

Give each loop iteration and each `.map` callback call a child cache by position, and wrap result arrays in `keep()` (debate P5, A2, P16).

## Acceptance

- [ ] 0 differences on `base` and `tuning`, including the `forloop` case that 0.8 fails.
- [ ] `map` one-item-replaced and append re-render 1 row, as in proof T2.
- [ ] A `.map` inside a ternary arm and a ternary inside a `.map` callback both match uncompiled output.
- [ ] Memory for a 1,000-row list is measured and recorded in `outcome.md` (debate O7).
- [ ] The size threshold holds on `base` and `tuning` (premortem 5).
- [ ] Fast check passes.

## Sizing

M: one planner pass, emit already supports iteration nodes.

## Notes for the worker

- Keys are out of scope. If positional caches fail a measured row, say so in `outcome.md` and the orchestrator decides on `keyed-iterations`.
