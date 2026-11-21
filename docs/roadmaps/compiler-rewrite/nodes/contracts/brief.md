---
id: contracts
title: Freeze the compiler, runtime and phase contracts
status: todo
priority: must
type: contract
milestone: sound-baseline
gate: true
size: M
verify: pnpm --filter forgetti typecheck && pnpm --filter forgetti test
owns:
  - packages/forgetti/src/next/ir.ts
  - packages/forgetti/src/next/index.ts
  - packages/forgetti/src/next/plan/index.ts
  - packages/forgetti/runtime/next.ts
  - packages/forgetti/test/next/api.test.ts
  - packages/forgetti/test/next/fixtures/**
  - packages/forgetti/package.json
  - packages/forgetti/vitest.config.ts
  - packages/forgetti/src/next/ownership/index.ts
  - oxlint.config.ts
  - pnpm-lock.yaml
provides: [compiler-api, runtime-api, phase-ir]
depends_on: []
---

# Freeze the compiler, runtime and phase contracts

## Goal

Turn the three draft contracts in `contracts/` into code and freeze them. After this node, every other node can build against stable types.

## Context

- `contracts/compiler-api.md`, `contracts/runtime-api.md`, `contracts/phase-ir.md` are the drafts. Adjust them where the real oxc-parser types differ, then set `status: frozen` through the orchestrator (write the final text in your `outcome.md`).
- Add `oxc-parser` and `magic-string` at their latest versions to `packages/forgetti` dependencies. Add `react`, `react-dom`, `preact` and `happy-dom` as devDependencies and a DOM environment in `vitest.config.ts`, so `runtime` and `emit` can run emitted code. Check `npm view <pkg> version`; do not use versions from memory.
- Create `src/next/plan/index.ts` as an ordered list of planner passes (`(scope, ownership, plan) => plan`), empty for now. Each later planner node adds its pass in its own file and one line here.
- Fix the pass order in `src/next/plan/index.ts` as a typed list with one named entry per planner node: `baseline`, `groups`, `branches`, `loops`. Each entry imports its own file, so each owner edits only that file.
- Add a stub `analyzeOwnership()` in `src/next/ownership/index.ts` that returns no groups. `s1-baseline` calls it, and `ownership` replaces its body.
- Narrow the lint exemption in `oxlint.config.ts` from `packages/forgetti/src/**` to the 0.8 folders (`src/core/**`, `src/index.ts`), so `src/next/**` is linted from the start.
- Nothing in `src/next/` or `runtime/next.ts` may be exported from `package.json` yet.

## Acceptance

- [ ] `src/next/ir.ts` exports the phase-ir types and typechecks against `oxc-parser`'s types.
- [ ] `src/next/index.ts` exports `compile()` as the stub in `compiler-api.md`, returning the input and a `units` list.
- [ ] `runtime/next.ts` exports `EMPTY`, `useCache`, `branch` and `keep`.
- [ ] Fixtures `test/next/fixtures/ternary.plan.ts`, `derived.plan.ts` and `map.plan.ts` hold hand-written `CachePlan`s for the debate corpus files, matching proof T2's hand output. Together they cover a branch node, an iteration node and a `keep` block.
- [ ] `api.test.ts` has a non-ASCII input, so offsets are checked as UTF-16 indices.
- [ ] `test/next/api.test.ts` covers the stub.
- [ ] Fast check passes: `pnpm --filter forgetti test`

## Sizing

M: types only plus two fixtures, but every later node depends on them.

## Notes for the worker

- Keep types minimal. A field nobody reads yet is a field someone will have to change.
