---
id: runtime-test-speed
title: Cut the runtime test matrix time
status: todo
priority: should
type: chore
milestone: sound-baseline
size: S
added: 2026-11-22
verify: pnpm --filter forgetti test test/next/runtime
owns:
  - packages/forgetti/test/next/runtime/**
  - packages/forgetti/test/next/runtime.test.ts
depends_on:
  - on: runtime
    kind: hard
    why: changes the test files that runtime added
---

# Cut the runtime test matrix time

## Goal

`pnpm --filter forgetti test` takes about 85 s, and 94% of that is the runtime matrix in `test/next/runtime.test.ts`. Every later node runs it in its fast check. Bring the full forgetti test run under 40 s without losing coverage.

## Context

- Evidence: the `runtime` review (2026-11-22, commit `cf87d76`) measured 84.5 s. Most of it is the `update` scenario: 11 waits of 400 ms, 4 runs each, 3 matrix rows, about 53 s.
- The 400 ms waits exist because React 19 holds back resolved Suspense content for about 300 ms after a fallback. Preact has no such throttle.
- Two cheap fixes the reviewer proposed: make the wait depend on the adapter (React 400 ms, Preact 100 ms), and split the React and Preact matrices into separate test files so vitest runs them in parallel.
- Do not use fake timers: React's scheduler and the throttle make them fragile. Do not run variants concurrently inside one test: `scenarios.ts` uses a shared module-level `log`.
- Keep `expectReached`: every scenario must still reach its intended state on both renderers.

## Acceptance

- [ ] `pnpm --filter forgetti test` takes under 40 s on this machine (print before and after in the outcome).
- [ ] Every scenario and matrix row from `runtime` still runs, and `expectReached` still passes on both renderers.
- [ ] No test needs a timeout above 60 s.
