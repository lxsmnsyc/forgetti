---
id: harness-multifile
title: Compile sibling modules in the compare harness
status: todo
priority: must
type: feature
milestone: planner
size: M
added: 2026-11-23
verify: pnpm --filter compare test
owns:
  - benchmarks/compare/src/**
  - benchmarks/compare/test/**
  - benchmarks/compare/package.json
depends_on:
  - on: regate
    kind: hard
    why: debate-2 follows the regate result
---

# Compile sibling modules in the compare harness

## Goal

Let a corpus case span several files, as real libraries do. A case folder may hold sibling modules next to `input.jsx` or `input.tsx`. The harness compiles every sibling with the compiler under test, so imports between them resolve to compiled code (debate-2 P14, O13). Single-file cases behave exactly as today.

## Acceptance

- [ ] Relative imports from the input to siblings in the case folder load the sibling compiled by the same compiler as the input, on React and Preact.
- [ ] Gzip counts every compiled file of a case, with one runtime import as before.
- [ ] The compiled share counts the components of every file.
- [ ] `sumWork` in `src/metrics.ts` throws a clear error when a cell failed to load, instead of recursing (regate gotcha).
- [ ] A test fixture case with two files under `benchmarks/compare/test/` proves the above. No corpus set changes.
- [ ] `pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2` gives the same table and checks as `benchmarks/compare/results/regate/checks.txt` (no multi-file case exists yet).

## Notes for the worker

- Do not open `benchmarks/corpus/heldout*/` beyond what the gate run prints. Do not change compiler code.
