---
name: corpus-format
version: 1
status: draft
defined_by: harness
---

# Contract: corpus-format

## Purpose

How a corpus case is written so the harness can compile, run and score it. Used by `corpus-tuning`, `corpus-heldout` and every gate.

## Interface

Each case is a folder `benchmarks/corpus/<set>/<name>/` with:

- `input.jsx` (or `.tsx`): one or more components or hooks. Uses `bump()` and the counted `Child`, `Row` and `Btn` from `benchmarks/corpus/shared/counter.js`.
- `scenarios.js`: `export default [{ name, props, context?, wrap?, steps: [{ name, props?, act? }] }]`. `act` runs inside React's `act()` and may call `startTransition`, resolve a promise or set state through an exported setter.
- `meta.json`: `{ "source": "<url or 'written'>", "license": "<SPDX or 'n/a'>", "targets": ["react", "preact"] }`.

Sets: `base` (the 15 debate files), `tuning`, `heldout`.

## Behavior

- The harness renders each step with uncompiled, forgetti 0.8, React Compiler 1.0 and the new compiler, on React 19.3 and Preact 11.2 (React Compiler on React only).
- A step's HTML and its value log must match uncompiled exactly.
- Counts are child renders from the counted components plus `bump()` calls.

## Stub

The 15 files in `debate/evidence/corpus/` converted to this format by `harness`.

## Contract tests

`pnpm --filter compare test` runs the harness on `base` with uncompiled output and must report 0 differences.

## Changes

- v1: initial.
