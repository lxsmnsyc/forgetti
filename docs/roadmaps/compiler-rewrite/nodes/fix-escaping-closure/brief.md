---
id: fix-escaping-closure
title: Compile components that bail out as escaping-closure
status: done
priority: must
type: fix
milestone: tree-cache
size: M
added: 2026-11-24
spent: 365842
verify: pnpm --filter compare gate --set base --set tuning
owns:
  - packages/forgetti/src/next/eligibility/**
  - packages/forgetti/test/next/eligibility/**
  - benchmarks/corpus/tuning/escaping_closure/**
depends_on:
  - on: fix-rc-children
    kind: hard
    why: sequential run; the gate rows must be read after the planner fixes
---

# Compile components that bail out as escaping-closure

## Goal

`SignupForm` in `heldout/form_validation` bails out as `escaping-closure` and runs uncompiled: 72 against React Compiler 25. Find the closure shape, decide whether the bailout is needed for soundness, and narrow it so the component compiles when it is safe.

## Acceptance

- [ ] A tuning case `tuning/escaping_closure` reproduces the shape in fresh code.
- [ ] `heldout/form_validation` is at or below React Compiler on React, with 0 differences.
- [ ] Every case that must still bail out has a unit test showing the stale read it prevents.
- [ ] Fast check passes.

## Notes for the worker

- Prove the bailout is too broad first: write the smallest component that bails, and show by hand-written cached output or reasoning that caching it is sound.
- `heldout` is exposed (see `debate/amendment-1.md`). Do not read `heldout2`.
