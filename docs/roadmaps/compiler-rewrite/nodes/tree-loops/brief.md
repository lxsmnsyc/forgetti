---
id: tree-loops
title: S3: positional iteration caches and keep()
status: done
spent: 272534
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
  - on: fix-control-deps
    kind: hard
    why: loops add control dependence of their own and must build on the fixed block inputs in groups.ts
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

- From `emit` (see its outcome): emit inserts a block's code before the statement that holds `at`, so it runs before the rest of that statement (`f(g(), c ? a : b)`). Pick `at` so that hoisting does not reorder side effects. Emit treats neither optional chaining nor default parameters as conditional: never place a block inside one. `Output.local` names must not clash with user bindings. Emit does not check that an output range lies inside its anchor, so a wrong plan reads a stale slot instead of failing.
- From `fix-control-deps` (see its outcome): a group written inside any loop body, or after a `break`, `continue` or `throw` that can skip the write, is not cached. This raised `base/forloop` work from 14 to 17, and total React work is now level with React Compiler at 166. Loop caches must win this back without dropping the refusal: a loop's own child cache is fine, but a block after the loop that reads a local written inside it must key on every input the loop reads, or stay uncached.
