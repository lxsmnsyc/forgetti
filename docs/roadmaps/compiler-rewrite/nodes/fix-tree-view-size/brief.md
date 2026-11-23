---
id: fix-tree-view-size
title: Bring heldout/tree_view under 1.15 times React Compiler gzip
status: done
priority: must
type: fix
milestone: tree-cache
size: S
added: 2026-11-24
spent: 174559
verify: pnpm --filter compare gate --set base --set tuning --set heldout
owns:
  - packages/forgetti/src/next/emit/**
  - packages/forgetti/src/next/plan/cost.ts
  - packages/forgetti/test/next/emit/**
depends_on:
  - on: fix-escaping-closure
    kind: hard
    why: sequential run; size is measured after the work fixes
---

# Bring heldout/tree_view under 1.15 times React Compiler gzip

## Goal

`heldout/tree_view` is 1985 gzip bytes against React Compiler's 1634 (1.215). Find what makes it large and cut it below 1.15 without adding work on any file.

## Acceptance

- [ ] `heldout/tree_view` at most 1.15 times React Compiler gzip.
- [ ] No file gains work; 0 differences; total gzip does not rise.
- [ ] Fast check passes.
