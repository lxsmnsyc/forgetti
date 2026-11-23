---
id: family-1
title: Planner family 1, component identity (rules A, B, C)
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

## Orchestrator notes

- Family: component identity, rules A, B and C from `results/census/census.md`, built together (user ruling, `debate-2/debate.md` Overruled):
  - A: a `memo` or `forwardRef` module binding stays identity-stable when every member write on it is an unconditional top-level statement.
  - B: a fresh literal nested in an element attribute or child, or in a cached call argument, gets its own block, and the element compares that block's output.
  - C: `new Date(x)` with an argument reads no clock. `Date.now()` and `new Date()` stay impure.
- Predicted share: 102 React units and 102 Preact units on the development sets (`discussions_table` 56, `form_check` 27, `toast_stack` 19). Stop rule: below 51 closed on React, record and stop.
- The 15% entry criterion above is met by the user's ruling.
- `results/census/variants/` holds the source stand-ins the census measured; a real rule that caches less saves less.
