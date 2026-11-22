---
id: corpus-heldout
title: Held-out corpus of real-shaped components
status: active
priority: must
type: feature
milestone: sound-baseline
size: M
verify: pnpm --filter compare test --set heldout
owns:
  - benchmarks/corpus/heldout/**
depends_on:
  - on: harness
    kind: hard
    why: the acceptance self-check runs in the finished harness
---

# Held-out corpus of real-shaped components

## Goal

Add at least 10 real-shaped components of 100 to 250 lines from public open-source React apps. They are read only by `final-gate`, so the planner cannot be tuned to them (debate P10, O14).

## Context

- Shapes: a data table with sort, a form with validation, a list with filters, a modal with effects, a dashboard card, and five more of your choice from real apps.
- Check each source license. Keep only MIT, Apache-2.0, BSD or ISC code, and record source URL and license in `meta.json`.
- Replace data fetching with props or a resolved promise so the cases run offline.

## Acceptance

- [ ] At least 10 cases in `benchmarks/corpus/heldout/`, each 100 to 250 lines, with scenarios.
- [ ] Uncompiled output gives 0 differences on React and Preact.
- [ ] Every `meta.json` has a source URL and an allowed license.

## Sizing

M: finding and adapting 10 components.

## Notes for the worker

- Do not run forgetti or React Compiler on these files. Only the harness self-check on uncompiled output.
