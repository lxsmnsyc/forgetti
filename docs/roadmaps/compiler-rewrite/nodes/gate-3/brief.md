---
id: gate-3
title: Hypothesis gate on heldout3 under debate 2
status: todo
priority: must
type: experiment
milestone: planner
gate: true
hypothesis: docs/roadmaps/compiler-rewrite/debate-2/debate.md
size: M
added: 2026-11-23
verify: pnpm --filter compare gate --set heldout3
owns:
  - benchmarks/compare/results/**
depends_on:
  - on: prune-bytes
    kind: hard
    why: the gate measures the final planner
  - on: corpus-heldout-3
    kind: hard
    why: heldout3 is the gate input
  - on: mutation-check
    kind: hard
    why: the mutants are part of the soundness check
---

# Hypothesis gate on heldout3 under debate 2

## Goal

Run the thresholds of `debate-2/debate.md` on `heldout3` alone, then on all sets (`base`, `tuning`, `heldout`, `heldout2`, `heldout3`), on React and Preact. Record the result in `benchmarks/compare/results/gate-3.md`, including a miss.

## Acceptance

- [ ] Every threshold with its value and pass or miss, `heldout3` alone and all sets.
- [ ] next at `5308757` is also run on `heldout3`, so a gain shows on a miss.
- [ ] The mutation check passes on the batch head.
- [ ] forgetti 0.8 rows reported only, as in `regate`.
- [ ] `outcome.md` says pass, work miss, or kill. A sound, within-size work miss ships the compiler with the miss recorded (Q1); no fix round reads `heldout3` output.

## Notes for the worker

- Do not change compiler code.
