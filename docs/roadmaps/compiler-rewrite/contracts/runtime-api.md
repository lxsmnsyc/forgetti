---
name: runtime-api
version: 1
status: frozen
defined_by: contracts
---

# Contract: runtime-api

## Purpose

The runtime the emitted code calls. Lives in `packages/forgetti/runtime/next.ts`. Used by `emit` and implemented by `runtime`.

## Interface

```ts
// Empty slot marker. A slot holding EMPTY is never a hit.
export const EMPTY: unique symbol;

// Root cache of one component or hook. `useRef` is the preset's hook (React or Preact).
export function useCache(useRef: <T>(initial: T) => { current: T }, size: number): unknown[];

// Child cache at parent[index], created on first use with `size` EMPTY slots.
// `index` may lie past the parent's length, as in an iteration node whose parent has size 0.
export function branch(parent: unknown[], index: number, size: number): unknown[];

// Returns the array stored at cache[index] when it has the same length and Object.is-equal
// elements as `next`, otherwise stores `next` and returns it.
export function keep<T extends unknown[]>(cache: unknown[], index: number, next: T): T;
```

## Behavior

- Equality is `Object.is` everywhere.
- `keep` stores `next` itself, not a copy, and returns the stored array on a hit so its identity is stable.
- `branch` treats any non-array value at `parent[index]`, including `EMPTY` and `undefined`, as missing.
- `useCache` and `branch` fill new arrays with `EMPTY`. Neither writes to an existing array.
- Emitted code follows one write rule: compute the value into a local, then write every input and the value after it returns. The runtime never writes inputs on behalf of a slot.

## Stub

`contracts` ships the three functions and `EMPTY` with real implementations of a few lines each, since they are small. `runtime` hardens them and adds the tests.

## Contract tests

`packages/forgetti/test/next/runtime.test.ts`: the proof T1 cases from `debate/evidence/proof-t1/` (interrupted transition, Suspense on mount and update, StrictMode, throw and retry) on React 19.3 and Preact 11.2.

## Changes

- v1: initial, frozen by `contracts`. Clarifications only.

