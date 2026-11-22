# Outcome: runtime

## Built

- `packages/forgetti/runtime/next.ts`: `EMPTY`, `useCache`, `branch`, `keep`, same signatures as `runtime-api` v1. Hardened from the stub: smaller code, 387 bytes minified (esm, es2018, tsdown), 255 gzipped.
- `packages/forgetti/test/next/runtime.test.ts`: contract test. Proof T1 ported to vitest and happy-dom on React 19.3.1 and Preact 11.2.0. Each scenario runs uncompiled and with hand-written slot code (value-first, `useMemo`, and a `branch` + `keep` variant) and compares HTML after each step plus the log of every render.
  - React: simple, interrupted transition, suspend on mount, suspend on update, throw on update, throw after slots written, throw in a transition. Each in StrictMode too.
  - Preact: the same without the interrupted transition (Preact cannot interrupt) and without StrictMode (Preact has none). Transitions are plain updates there.
  - Write order: inputs-first output differs from uncompiled on React for `throw` and `transition`.
- `packages/forgetti/test/next/runtime/`: `scenarios.ts` (scenario engine), `adapters.ts` (React and Preact adapters), `api.test.ts` (unit tests: EMPTY fill, stable root, `branch` past the parent length and over non-arrays, `keep` hit, miss, `NaN`, `-0`, identity, length; pure write-order test with throw and retry), `size.test.ts` (builds the runtime with tsdown minify, prints bytes to stderr, asserts under 400).

## Deviations

- None. The contract was not changed. `scenarios.ts` is the T1 engine reusable by `emit`-side tests if wanted.

## Stubs left

- None.

## Gotchas

- `useCache` uses `||=` with a lint disable: `??=` costs 19 bytes at the es2018 target and pushes the runtime over 400. `Symbol('empty')` keeps a description for the same lint rule.
- `keep` walks from the end and ends with `position` at -1 on a hit. Do not "simplify" to a forward loop without rechecking the size test (limit 400, now 387).
- `keep` writes `next` into its own slot at call time. This is safe only because the slot's own inputs-tuple slot (the one compared by `c[i] === tuple`) is written after the value computes, as in the `branch` variant of `scenarios.ts`. Emit must keep that split.
- Vitest hides `console.log` of passing tests. The size test writes to stderr; run `pnpm --filter forgetti test test/next/runtime/size --silent=false` to see it.
- The existing `runtime/index.ts` (0.8 runtime) raises three `no-new-array` lint warnings. Not in this node.

## Proposed learnings

- Runtime size is gated by a test; check it after any edit to `runtime/next.ts` | the budget is 400 bytes and a single syntax choice moves it by 20 | packages/forgetti/runtime | yes

## Verification

- `pnpm --filter forgetti test test/next/runtime`: 45 tests pass (22 matrix, 22 unit, 1 size).
- `pnpm --filter forgetti test`: 296 pass.
- `pnpm --filter forgetti typecheck`: pass. `pnpm oxlint` on owned files: no errors. `pnpm format:check`: pass.
- `pnpm lint` as a whole was not used as a gate (it fails on the base from files outside this node).

## Size

- Estimated M, actual M.
