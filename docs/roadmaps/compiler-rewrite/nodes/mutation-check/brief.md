---
id: mutation-check
title: Mutation soundness check on the corpus
status: todo
priority: must
type: feature
milestone: planner
size: M
added: 2026-11-23
verify: pnpm --filter compare mutate
owns:
  - benchmarks/compare/mutate/**
  - benchmarks/compare/package.json
depends_on:
  - on: harness-rc-babel7
    kind: hard
    why: shares benchmarks/compare/package.json
  - on: harness-multifile
    kind: hard
    why: the check runs through the harness and shares its package.json
---

# Mutation soundness check on the corpus

## Goal

A script that inserts known hazards into the existing corpus files of `base`, `tuning`, `heldout` and `heldout2`, reuses each file's scenarios, and fails when any compiler under test differs from uncompiled output on a mutant (EMI, PLDI 2014; debate-2 O4, P15, P19). Every later planner change merges only with 0 differences on it, on React and Preact.

## Acceptance

- [ ] Operators, each applied wherever its pattern fits:
  - aliasing a prop into a call, a changing global read in render, a closure called in a child's render, a method call inside `.map`;
  - a same-module child used as a tag whose render reads `Date.now()`, a changing global or `ref.current`, with and without `memo` (O8);
  - a `map`, `filter` or `find` callback that changes its element, and a `find` result changed after the call (O12);
  - a top-level `displayName` or `X.Item` write moved into a conditional, a function body or a handler (O10).
- [ ] Mutants that change uncompiled output from the original are kept (the hazard must be visible); mutants that do not are reported as inert.
- [ ] `pnpm --filter compare mutate` runs every mutant against plain and next and exits 1 on a difference. It reports mutants per operator and per file.
- [ ] next at the batch head passes, or each difference is recorded in `outcome.md` as a follow-up fix.
- [ ] Mutants are generated, not committed.

## Notes for the worker

- Do not open `benchmarks/corpus/heldout3/`. Do not change compiler code.
- A family node adds its own operators here later.
