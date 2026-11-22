---
id: final-gate
title: S4: hypothesis gate on the full corpus
status: todo
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
