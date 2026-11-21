---
id: eligibility
title: Phase 2: eligibility and bailout diagnostics
status: todo
priority: must
type: feature
milestone: sound-baseline
size: M
verify: pnpm --filter forgetti test test/next/eligibility
owns:
  - packages/forgetti/src/next/eligibility/**
  - packages/forgetti/test/next/eligibility/**
depends_on:
  - on: contracts
    kind: contract
    via: phase-ir
  - on: parse-scope
    kind: behavior
    via: phase-ir
---

# Phase 2: eligibility and bailout diagnostics

## Goal

Phase 2: decide per unit whether it can be compiled, and give a `BailoutReason` and a message when it cannot (debate P3, P14).

## Context

- Bailout triggers (debate "Settled structure", step 2): mutation of props, state or hook arguments; a fresh value stored in `ref.current` or a module variable; a fresh value returned from a hook; a hook called conditionally or in a loop (`use()` is allowed there).
- The escaping-closure trigger needs ownership groups. Leave it to `ownership`, which reports it through the same `Eligibility` type.
- `debate/evidence/corpus/bailout.jsx` must bail with `mutates-props`. React Compiler reports the same reason there.

## Acceptance

- [ ] One test per bailout reason, plus one per allowed pattern next to it (for example `use()` in a branch is allowed, `useState` in a branch is not).
- [ ] Every 15-file base case except `bailout` is eligible.
- [ ] Fast check passes.

## Sizing

M: rules are listed; tests are the bulk.
