---
id: ownership
title: Phase 3: ownership and alias groups
status: todo
priority: must
type: feature
milestone: grouped-slots
size: L
verify: pnpm --filter forgetti test test/next/ownership
owns:
  - packages/forgetti/src/next/ownership/**
  - packages/forgetti/test/next/ownership/**
depends_on:
  - on: contracts
    kind: contract
    via: phase-ir
  - on: parse-scope
    kind: behavior
    via: phase-ir
---

# Phase 3: ownership and alias groups

## Goal

Phase 3: classify values in each unit as fresh, frozen or opaque, and build alias groups with their mutations, freeze point and non-fresh inputs (debate P7, P14, O12).

## Context

- Joins: assignment, a store into a field, array element, `Map` or `Set` of another fresh value, closure capture (calling the closure is a mutation). A spread copy starts a new group.
- An unknown call that receives a fresh value is a mutation site, not a bailout.
- A closure holding a fresh value that escapes before the group is frozen is a bailout (`escaping-closure`), reported as an `Eligibility`.
- `inputs` of a group are its transitive non-fresh inputs (props, state, hook results), so a frozen group can be cached as one block (debate O12).

## Acceptance

- [ ] Unit tests for every join and bailout above.
- [ ] On each tuning alias case, the groups and freeze points match a hand-written expectation in the test.
- [ ] Fast check passes.

## Sizing

L: uncertainty medium (new design), size medium to high.

## Notes for the worker

- From `parse-scope` (see its outcome): when a unit has a parameter default or a computed parameter key, its body bindings live in a child `block` scope under the `unit` scope. Walk the scope chain; never test `scope === unitScope`. `arguments` resolves as a global.
