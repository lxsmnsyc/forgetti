---
id: final-gate
title: S4: hypothesis gate on the full corpus
status: done
spent: 229485
priority: must
type: experiment
milestone: tree-cache
gate: true
hypothesis: docs/roadmaps/compiler-rewrite/debate/debate.md
size: M
verify: pnpm --filter compare gate --set base,tuning,heldout
owns:
  - benchmarks/compare/results/**
depends_on:
  - on: tree-branches
    kind: hard
    why: the gate measures the finished planner
  - on: tree-loops
    kind: hard
    why: the gate measures the finished planner
  - on: corpus-heldout
    kind: hard
    why: the held-out set is the gate input
  - on: corpus-tuning
    kind: hard
    why: the tuning set is part of the gate
  - on: eligibility-writes
    kind: hard
    why: the gate measures the finished soundness rules
---

# S4: hypothesis gate on the full corpus

## Goal

Run the hypothesis in `debate/debate.md` on every corpus set and both targets, and record the result, including when it misses.

## Acceptance

- [ ] `benchmarks/compare/results/final-gate.md` holds the full table and each threshold with its measured value and pass or miss.
- [ ] Compile time on oxc is measured against forgetti 0.8 and React Compiler (debate P6, S4).
- [ ] A size or timing threshold counts as met only beyond the noise, measured with perf-pass's `bench.py`.
- [ ] On a miss or a kill criterion, `outcome.md` says which, and the roadmap stops for a new debate.

## Sizing

M: runs existing tools; the judgment is in reading the result.

## Notes for the worker

- Do not change compiler code in this node. A failing case becomes a follow-up node.
- From `tree-loops` review: nested `var` loops with closures reading both loop variables (`for (var r of rows) for (var c of r)`, or `let` outer with `var` inner) show soundness differences for every compiler, React Compiler and forgetti 0.8 included, on the batch before `tree-loops` too. The cause is not confirmed; it looks like a harness artifact. If a held-out case has this shape, find the cause before counting its row.
- `tuning/loop_shapes` scenarios `var_counter_same` and `var_counter_shrink` do not fail without the `var` fix (only `var_of/*` do). The unit test in `test/next/plan/loops/` guards the counter case.
- Held-out exposure (2026-11-24): the orchestrator showed the user the compiled output of `heldout/hex_input` (forgetti 0.8, React Compiler, new compiler) and its table row, after `tree-loops`. No compiler code changed because of it. Seen weak spot: a block keyed on a `...rest` destructured from props never hits, since `rest` is a new object each render; React Compiler caches the destructure on `props`. Report `hex_input` rows as seen, and do not treat this weak spot as a reason to retune before the gate runs.
