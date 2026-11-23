---
id: fix-rc-callbacks
title: Match React Compiler on callbacks, JSX props, mutation and try/catch
status: done
spent: 317289
priority: must
type: fix
milestone: tree-cache
size: M
added: 2026-11-24
verify: pnpm --filter compare gate --set base --set tuning
owns:
  - packages/forgetti/src/next/plan/**
  - packages/forgetti/test/next/plan/**
depends_on:
  - on: final-gate
    kind: hard
    why: the gate rows are the problem statement
---

# Match React Compiler on callbacks, JSX props, mutation and try/catch

## Goal

On the React target, bring these files to at or below React Compiler's work (from `benchmarks/compare/results/final-gate.md`): `base/callback` 3 against 1, `base/jsxprops` 6 against 1, `base/mutate` 4 against 2, `base/trycatch` 4 against 2.

## Acceptance

- [ ] Each of the four files is at or below React Compiler on React, and not above uncompiled on Preact.
- [ ] 0 differences on `base` and `tuning`, both targets.
- [ ] No other file in `base` or `tuning` gets more work, and gzip stays within the thresholds in `debate/amendment-1.md`.
- [ ] Fast check passes.

## Notes for the worker

- Prove each gap first with the compare table on the current batch (`pnpm --filter compare table --set base --case <name>`), then find the cause in the plan.
- Do not read `heldout` outputs. Do not read React Compiler's source; its compiled output in `benchmarks/compare/.out/react-compiler/` may be read as a black box.
