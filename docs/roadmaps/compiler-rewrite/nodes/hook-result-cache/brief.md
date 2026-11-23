---
id: hook-result-cache
title: Cache work derived from hook results
status: todo
priority: should
type: feature
milestone: tree-cache
size: M
added: 2026-11-24
verify: pnpm --filter compare gate --set base --set tuning
owns:
  - packages/forgetti/src/next/plan/**
  - packages/forgetti/test/next/plan/**
depends_on:
  - on: fix-tree-view-size
    kind: hard
    why: sequential run after the must fixes
---

# Cache work derived from hook results

## Goal

On `base/hook` (6), `tuning/hook_nested` (11) and `tuning/hook_object` (5) the new compiler equals React Compiler, while forgetti 0.8 is sound and does 2, 4 and 0. Beat React Compiler here where it is safe. This is a place forgetti can do better than React Compiler, not a threshold.

## Acceptance

- [ ] At least two of the three files below React Compiler on React, 0 differences.
- [ ] No other file gains work. Fast check passes.
