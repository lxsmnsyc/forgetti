---
id: s1-baseline
title: S1: wire phases 1, 2 and 5 into a sound baseline compiler
status: todo
priority: must
type: feature
milestone: sound-baseline
size: M
verify: pnpm --filter compare gate --set base,tuning --only soundness
owns:
  - packages/forgetti/src/next/index.ts
  - packages/forgetti/src/next/plan/baseline.ts
  - packages/forgetti/test/next/plan/baseline/**
shared:
  - packages/forgetti/src/next/plan/index.ts
depends_on:
  - on: parse-scope
    kind: hard
    why: compile() calls the real phase 1
  - on: eligibility
    kind: hard
    why: compile() calls the real phase 2
  - on: emit
    kind: hard
    why: compile() calls the real phase 5
  - on: harness
    kind: hard
    why: the acceptance gate runs in the harness
  - on: corpus-tuning
    kind: hard
    why: the gate needs the throw and alias cases
  - on: runtime
    kind: hard
    why: the gate runs emitted code on the hardened runtime
---

# S1: wire phases 1, 2 and 5 into a sound baseline compiler

## Goal

Make `compile()` real with a baseline planner: JSX elements and call results are cached by their plain input set, and anything that depends on a local that is ever mutated is not cached. The result must be sound before anything is optimized (debate P6, S1).

## Context

- `src/next/plan/index.ts` is the pass list created by `contracts`. Add the baseline pass as one line.
- No ownership yet: treat every mutated local as uncacheable, and every value read from it too.

## Acceptance

- [ ] 0 differences from uncompiled output on `base` and `tuning`, React and Preact.
- [ ] Every unit the harness reports is either compiled or has a diagnostic.
- [ ] `outcome.md` records lines written and tokens spent so far against the debate budget (9k lines, 600k tokens). If S1 alone passes half of either, say so first.
- [ ] Fast check passes.

## Sizing

M: glue plus a simple planner, but it is the first end-to-end run.
