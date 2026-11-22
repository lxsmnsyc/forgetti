---
id: harness
title: Corpus harness for forgetti 0.8, React Compiler and the new compiler
status: done
priority: must
type: feature
milestone: sound-baseline
size: M
spent: 216111
verify: pnpm --filter compare test
owns:
  - benchmarks/compare/**
  - benchmarks/corpus/base/**
  - benchmarks/corpus/shared/**
  - pnpm-workspace.yaml
shared:
  - pnpm-lock.yaml
  - .changeset/config.json
provides: [corpus-format]
depends_on:
  - on: contracts
    kind: contract
    via: compiler-api
---

# Corpus harness for forgetti 0.8, React Compiler and the new compiler

## Goal

Turn the debate's measurement scripts into a workspace package that compiles every corpus case with uncompiled, forgetti 0.8, React Compiler 1.0 and the new compiler, runs the scenarios on React 19.3 and Preact 11.2, and checks the debate's thresholds.

## Context

- Start from `debate/evidence/compile.mjs`, `runtime.mjs`, `extra.mjs` and `debate/evidence/corpus/`. Convert the 15 files to `contracts/corpus-format.md` under `benchmarks/corpus/base/`.
- forgetti 0.8 comes from npm (`forgetti@0.8.5`), so it keeps working after `switch` removes the 0.8 source.
- The new compiler is called through `compile()` from `packages/forgetti/src/next/index.ts` (compiler-api).
- Freeze `contracts/corpus-format.md` (final text in your `outcome.md`).

## Acceptance

- [x] `pnpm --filter compare table` prints, per case: bytes raw and gzip, slots, compile ms, bailouts, and per scenario the renders, recomputes and HTML match, for each compiler and target.
- [x] `pnpm --filter compare gate --set <set>` exits 1 when any hypothesis threshold in `debate/debate.md` fails for the chosen sets, and prints which.
- [x] `pnpm --filter compare test` reports 0 differences for uncompiled output on `base`.
- [x] The numbers for React Compiler and forgetti 0.8 on `base` match `debate/evidence/out/` within noise.

## Sizing

M: the scripts exist; the work is packaging, the Preact runner and the gate.

## Notes for the worker

- Preact 11 runs through `preact` and `preact/hooks` directly, not `preact/compat`, except for `use()`.
- Mark the package `"private": true`. Add it to changesets `ignore`.
