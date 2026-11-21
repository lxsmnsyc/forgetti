---
id: tree-branches
title: S3: child caches for branches
status: todo
priority: must
type: feature
milestone: tree-cache
size: M
verify: pnpm --filter compare gate --set base,tuning --only soundness,size
owns:
  - packages/forgetti/src/next/plan/branches.ts
  - packages/forgetti/test/next/plan/branches/**
shared:
  - packages/forgetti/src/next/plan/index.ts
depends_on:
  - on: planner-groups
    kind: hard
    why: branch nodes hold the grouped slot blocks
---

# S3: child caches for branches

## Goal

Give each branch of `if`, `switch`, a ternary and `&&`, `||`, `??` that holds a cached value its own lazy child cache, so a branch that is not taken keeps its cache and an inactive branch input does not invalidate the active one (debate P5).

## Acceptance

- [ ] 0 differences on `base` and `tuning`.
- [ ] `ternary` and `switch` re-render counts match proof T2's hand output (no re-render on an inactive branch input).
- [ ] Early returns keep the cache hook above them (debate J5).
- [ ] The size threshold holds on `base` and `tuning` (premortem 5).
- [ ] Fast check passes.

## Sizing

M: one planner pass, emit already supports branch nodes.
