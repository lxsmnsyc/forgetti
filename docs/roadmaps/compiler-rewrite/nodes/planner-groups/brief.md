---
id: planner-groups
title: S2: dependency-set slot groups and the cheap-expression rule
status: todo
priority: must
type: feature
milestone: grouped-slots
size: M
verify: pnpm --filter compare gate --set base,tuning --only soundness,bailouts
owns:
  - packages/forgetti/src/next/plan/groups.ts
  - packages/forgetti/src/next/plan/cost.ts
  - packages/forgetti/test/next/plan/groups/**
shared:
  - packages/forgetti/src/next/plan/index.ts
  - packages/forgetti/src/next/index.ts
depends_on:
  - on: s1-baseline
    kind: hard
    why: replaces the baseline planner pass registered by s1-baseline
  - on: ownership
    kind: hard
    why: the soundness gate needs real alias groups, a stub cannot pass it
---

# S2: dependency-set slot groups and the cheap-expression rule

## Goal

Replace the baseline planner with the S2 planner: values with the same input set share one compare and one slot block, expressions cheaper than one compare get no slot, frozen ownership groups are cached as one block, and `use()`, hook calls and impure statements never get a slot (debate P3, P4, P14).

## Context

- `compile()` already calls `analyzeOwnership()` (stub from `contracts`, real since `ownership`). Check it is wired, and pass its result to the planner.

- The cost rule (`cost.ts`): literals, `a + 1`-style arithmetic, property reads of an input, and template strings of inputs are cheap. Unknown calls and JSX are not.

## Acceptance

- [ ] 0 differences on `base` and `tuning`, React and Preact.
- [ ] Compiled share on `base` and `tuning` is at least React Compiler's. Each unit the rewrite skips and React Compiler compiles is listed in `outcome.md` with its reason (debate P15).
- [ ] The O12 case (an unknown call feeding a child) re-renders the child no more than React Compiler.
- [ ] Fast check passes.

## Sizing

M: one planner pass on top of ownership.
