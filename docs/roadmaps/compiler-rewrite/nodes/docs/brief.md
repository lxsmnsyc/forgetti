---
id: docs
title: Rewrite the docs for the new compiler
status: todo
priority: must
type: docs
milestone: release
size: M
owns:
  - README.md
  - packages/forgetti/README.md
  - packages/vite/README.md
  - packages/rollup/README.md
  - docs/configuration.md
  - docs/optimizations.md
  - packages/forgetti/test/docs/**
depends_on:
  - on: regate
    kind: hard
    why: the documented output is final only after the regate
  - on: switch
    kind: behavior
    via: compiler-api
---

# Rewrite the docs for the new compiler

## Goal

Rewrite the user docs for the new compiler: options, presets for React 19 and Preact 11, bailout diagnostics, and what each phase does with an example, replacing the 0.8 `docs/optimizations.md`.

## Acceptance

- [ ] Every example in the docs is compiled by a test, so the docs cannot drift from the output.
- [ ] `docs/optimizations.md` names the 0.8 behaviors that changed (no outlined JSX, no caching of `use()` and impure statements).
- [ ] `check_prose.py` from plain-writing passes.

## Sizing

M: four files and one test.
