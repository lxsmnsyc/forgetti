---
id: family-1
title: Planner family node 1, chosen by the census
status: todo
priority: must
type: feature
milestone: planner
size: M
added: 2026-11-23
verify: pnpm --filter forgetti test && pnpm --filter compare mutate
owns:
  - packages/forgetti/src/next/**
  - packages/forgetti/test/**
  - benchmarks/compare/mutate/operators/**
depends_on:
  - on: census
    kind: hard
    why: the census picks the family
  - on: mutation-check
    kind: hard
    why: no planner change merges without 0 differences on mutants
---

# Planner family node 1, chosen by the census

## Goal

Fix the refusal family the census ranks first, as one general rule, not per-file patterns (debate-2 O18). The orchestrator sets the family and its predicted share in "Orchestrator notes" before the node starts. Rules already argued for the candidates are in `debate-2/debate.md` under "Candidate families".

## Acceptance

- [ ] Built only when the census puts at least 15% of the equal-to-plain steps on the family (P18). Otherwise the node is dropped.
- [ ] Closes at least half of the predicted share on the development sets; the result is recorded in `outcome.md` either way (P21). Below half, the node stops and no narrower rule follows.
- [ ] Adds mutation operators for its own hazards. 0 differences on the corpus and every mutant, React and Preact.
- [ ] No file above 1.15 times React Compiler gzip on the development sets.

## Notes for the worker

- Never open `benchmarks/corpus/heldout3/`.
- Read `results/census/census.md` and `debate-2/debate.md` (candidate families, open risks).
