---
id: census
title: Refusal census weighted by lost steps
status: active
priority: must
type: chore
milestone: planner
size: M
added: 2026-11-23
owns:
  - benchmarks/compare/results/census/**
depends_on:
  - on: corpus-heldout-3
    kind: hard
    why: the heldout3 library list must be fixed before the census reports (debate-2 O19)
---

# Refusal census weighted by lost steps

## Goal

Rank the planner's refusal families by the steps they cost, on the development sets only (`base`, `tuning`, `heldout`, `heldout2`). This picks the family nodes (debate-2 P12, O18). It extends proof T1 in `debate-2/evidence/T1-census.txt`.

## Acceptance

- [ ] Every refusal names the binding or use that failed, so identity and purity failures are split (O9, P17).
- [ ] `plan/groups.ts`, `plan/baseline.ts`, `plan/loops.ts`, `plan/branches.ts` and whole-unit bailouts are instrumented.
- [ ] Each refusal is joined to the steps where next does the uncompiled work (next equal to plain on that step), on React and Preact.
- [ ] `results/census/census.md` ranks families by lost steps and gives each family's share of the equal-to-plain steps, with the files it covers. Name which families cover `heldout2/discussions_table` and `heldout2/toaster_store`.
- [ ] The instrumentation is saved as a patch under `results/census/` and is not committed to `packages/`. Compiler output is unchanged.

## Notes for the worker

- Never run any compiler on `heldout3`, and do not open it.
- A refusal site is not a lost hit. Join by unit and binding, and say where the join is a guess.
