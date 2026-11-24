---
id: switch
title: Ship the new compiler as forgetti and port the plugins
status: todo
priority: must
type: feature
milestone: release
size: L
verify: pnpm build && pnpm typecheck && pnpm test
owns:
  - packages/forgetti/src/**
  - packages/forgetti/example.js
  - packages/forgetti/input.js
  - packages/forgetti/output.js
  - packages/forgetti/runtime/**
  - packages/forgetti/package.json
  - packages/forgetti/tsdown.config.ts
  - packages/forgetti/test/**
  - packages/vite/**
  - packages/rollup/**
  - examples/**
  - .changeset/**
  - oxlint.config.ts
  - pnpm-lock.yaml
depends_on:
  - on: gate-3
    kind: hard
    why: ships after the debate-2 gate (a sound, within-size work miss also ships, Q1)
---

# Ship the new compiler as forgetti and port the plugins

## Goal

Make the new compiler the `forgetti` package. Remove the 0.8 Babel compiler and its tests. Export `compile()` from `forgetti` and the new runtime from `forgetti/runtime`. Port `vite-plugin-forgetti` and `rollup-plugin-forgetti` to `compile()` with no `@babel/core`. Update the examples to React 19 and Preact 11.

## Acceptance

- [ ] `packages/forgetti/src/` holds only the new compiler. `@babel/*` is gone from every published package.
- [ ] Both example apps build and render with their plugin.
- [ ] The `packages/forgetti/src/**` lint exemption in `oxlint.config.ts` is removed and lint passes.
- [ ] A changeset at the level the maintainer approved (GOAL.md open question).
- [ ] Full check passes.

## Sizing

L: blast radius high (public API, every package), but the code already exists.
