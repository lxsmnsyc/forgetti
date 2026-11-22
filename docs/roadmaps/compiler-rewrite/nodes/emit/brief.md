---
id: emit
title: Phase 5: emit a CachePlan with magic-string
status: active
priority: must
type: feature
milestone: sound-baseline
size: L
verify: pnpm --filter forgetti test test/next/emit
owns:
  - packages/forgetti/src/next/emit/**
  - packages/forgetti/test/next/emit/**
depends_on:
  - on: contracts
    kind: contract
    via: phase-ir
  - on: runtime
    kind: contract
    via: runtime-api
---

# Phase 5: emit a CachePlan with magic-string

## Goal

Phase 5: turn a `CachePlan` into code with magic-string at the plan's source ranges. Covers root caches, branch and iteration child caches, `keep()` for result arrays, the `EMPTY` sentinel, and the runtime imports.

## Context

- Build against the hand-written fixtures from `contracts` (`test/next/fixtures/*.plan.ts`). The target output is proof T2's hand output (`debate/evidence/proof-t2/hand/`).
- Write rule (debate P17, J13): compute into a local, then write all inputs and the value together. No code path may write an input before its value.
- Source maps come from magic-string. No AST re-print.

## Acceptance

- [ ] For the `ternary` and `derived` fixtures, the emitted code behaves like proof T2's hand output in the T2 scenarios, and its raw bytes are within 10% of it.
- [ ] Hand-built plans with branch and iteration nodes emit `branch()` and `keep()` calls, tested by running the output.
- [ ] A throw-and-retry test for a call slot, a grouped slot and a per-row cache matches uncompiled output.
- [ ] Fast check passes.

## Sizing

L: blast radius low, but every later output goes through it, and size is medium to high.
