---
id: parse-scope
title: Phase 1: parse, find units, build bindings
status: done
priority: must
type: feature
milestone: sound-baseline
size: L
spent: 273720
verify: pnpm --filter forgetti test test/next/parse
owns:
  - packages/forgetti/src/next/parse/**
  - packages/forgetti/test/next/parse/**
depends_on:
  - on: contracts
    kind: contract
    via: phase-ir
---

# Phase 1: parse, find units, build bindings

## Goal

Phase 1 of the pipeline: parse with oxc-parser, find components and hooks by the preset filters (including HOC wrappers such as `memo` and `forwardRef`), and build bindings with read and write references, as `ScopeResult` in `phase-ir`.

## Context

- The lab's oxc compilers keep their own scope code. `solid-optimizer/packages/solid-optimizer/src/scope.ts` (707 lines) is the closest one to read for shape. Do not add a shared package or `oxc-walker` (rejected by the user).
- 0.8's unit detection rules are in `packages/forgetti/src/index.ts` and `src/core/utils/checks.ts`. Keep the same filters and the `/* @forgetti skip */` comment.
- Presets for React and Preact go in `src/next/parse/presets.ts`, including the hook types from compiler-api.

## Acceptance

- [x] Units found match 0.8's on every `benchmarks/corpus/base` file (or the 15 files in `debate/evidence/corpus/` if the harness is not merged yet).
- [x] Every identifier reference in a unit resolves to a binding or is reported as global. A test covers shadowing, closures, destructuring, `catch` and TS type positions (which are not references).
- [x] Fast check passes.

## Sizing

L: uncertainty low (lab pattern), size medium to high, context medium.
