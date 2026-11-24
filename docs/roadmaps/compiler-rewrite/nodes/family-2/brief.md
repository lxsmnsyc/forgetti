---
id: family-2
title: Planner family 2, fresh default parameters (rule D)
status: todo
priority: must
type: feature
milestone: planner
size: S
added: 2026-11-23
verify: pnpm --filter forgetti test && pnpm --filter compare mutate
owns:
  - packages/forgetti/src/next/**
  - packages/forgetti/test/**
  - benchmarks/compare/mutate/operators/**
depends_on:
  - on: family-1
    kind: hard
    why: same planner files; measured after family 1
---

# Planner family 2, fresh default parameters (rule D)

## Goal

A fresh literal default parameter (`function useStore(toastOptions = {})`) gets a cache block keyed on the parameter, so its identity holds across renders when the argument is absent. Only when the parameter is read-only in the unit (the same read-only check as call results); a default that is changed must stay fresh.

## Acceptance

- [ ] Closes at least 13 of the predicted 25 React units on the development sets (census rule D, `heldout2/toaster_store`). Below 13, record and stop (P21).
- [ ] Adds mutation operators: a default parameter changed in render, in a handler, and passed to an unknown call. 0 differences on the corpus and every mutant, React and Preact.
- [ ] No file above 1.15 times React Compiler gzip on the development sets.

## Notes for the worker

- Entry by user ruling (`debate-2/debate.md` Overruled): 25 of the 87 units over React Compiler.
- Never open `benchmarks/corpus/heldout3/`.
- Read `results/census/census.md`, `nodes/census/outcome.md` and `nodes/family-1/outcome.md`.
