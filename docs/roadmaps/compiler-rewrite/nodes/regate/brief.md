---
id: regate
title: S4b: hypothesis gate under amendment 1
status: todo
priority: must
type: experiment
milestone: tree-cache
gate: true
hypothesis: docs/roadmaps/compiler-rewrite/debate/amendment-1.md
size: M
added: 2026-11-24
verify: pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2
owns:
  - benchmarks/compare/results/**
  - benchmarks/compare/src/gate.ts
depends_on:
  - on: fix-rc-callbacks
    kind: hard
    why: the gate measures the fixed planner
  - on: fix-rc-children
    kind: hard
    why: the gate measures the fixed planner
  - on: fix-escaping-closure
    kind: hard
    why: the gate measures the fixed eligibility rules
  - on: fix-tree-view-size
    kind: hard
    why: the gate measures the size fix
  - on: corpus-heldout-2
    kind: hard
    why: the clean held-out set is the gate input
---

# S4b: hypothesis gate under amendment 1

## Goal

Run the thresholds in `debate/amendment-1.md` on every set and both targets, and record the result in `benchmarks/compare/results/regate.md`, including a miss.

## Acceptance

- [ ] First update `benchmarks/compare/src/gate.ts` to the amended thresholds (React Compiler and uncompiled as baselines, forgetti 0.8 reported only) in a separate commit, before reading any `heldout2` row.
- [ ] The gate replaces React Compiler's count with uncompiled output's on any step where React Compiler differs from uncompiled (amendment-1), and lists those steps.
- [ ] `regate.md` holds the full table and each threshold with its value and pass or miss, `heldout2` reported apart.
- [ ] forgetti 0.8 rows are listed with wrong steps marked, and every file where it is sound and lower is listed.
- [ ] On a miss or kill, `outcome.md` says which, and the roadmap stops.

## Notes for the worker

- Do not change compiler code. A failing case becomes a follow-up node.
- Gzip and counts are exact; compile time is not a threshold.
