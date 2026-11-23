---
id: fix-rc-children
title: Stop child re-renders on unchanged inputs (cart and dashboard shapes)
status: active
priority: must
type: fix
milestone: tree-cache
size: M
added: 2026-11-24
verify: pnpm --filter compare gate --set base --set tuning
owns:
  - packages/forgetti/src/next/plan/**
  - packages/forgetti/test/next/plan/**
  - benchmarks/corpus/tuning/stable_children/**
depends_on:
  - on: fix-rc-callbacks
    kind: hard
    why: both edit the planner; sequential run
---

# Stop child re-renders on unchanged inputs

## Goal

`heldout/cart_summary` (54 against React Compiler 24, r3 on the `same` step) and `heldout/dashboard_card` (32 against 12: 12 extra child re-renders and 8 extra recomputes) re-render children whose inputs did not change. Find the shapes that cause it, add a tuning case `tuning/stable_children` that reproduces them in fresh code, and fix the planner.

## Acceptance

- [ ] `tuning/stable_children` exists, fails the per-file rule against React Compiler on the current batch, and passes after the fix.
- [ ] `heldout/cart_summary` and `heldout/dashboard_card` are at or below React Compiler on React.
- [ ] 0 differences on all sets, both targets. No other file gets more work.
- [ ] Fast check passes.

## Notes for the worker

- `heldout` is exposed already (see `debate/amendment-1.md`), so reading these two files and their outputs is allowed. Do not read `heldout2`.
- One known shape from `heldout/hex_input`: a block keyed on a `...rest` destructured from props never hits, because `rest` is a new object every render. React Compiler caches the destructure keyed on `props`. Check whether the cart or dashboard rows come from this or from something else.
