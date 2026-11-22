# Change request: phase-ir v1 to v2

- From node: emit
- Status: open

## Problem

`SlotBlock.at` says: "each output's range is replaced by its local, and the local is declared with `let` in the inserted code." Emitted that way, the `ternary` and `derived` fixtures miss the brief's size criterion (raw bytes within 10% of `debate/evidence/proof-t2/hand/`):

| File | Hand | `let` locals | Slot reads |
| --- | --- | --- | --- |
| ternary | 468 | 571 (1.22) | 495 (1.06) |
| derived | 511 | 631 (1.23) | 537 (1.05) |

The local form needs `let t0 = $[1];` before each check and `t0` in each write. A slot read has the same write order: the value is computed, then stored, then the inputs are stored.

## Proposed change

Replace the last sentence of the `SlotBlock.at` comment with:

```ts
  // In both cases each output's range is replaced by a read of its value slot, such as `$[1]`.
  // `Output.local` names a temporary only when a value block has more than one output: all
  // values are computed into their locals before any slot is written.
```

And in "Behavior", add: "A `ValueRef` of kind `output` reads the same slot."

## Affected nodes

- `emit` (done, uses the proposed form).
- Planner nodes (`s1-baseline` and the groups, branches and loops planners): no change. They still fill `Output.local` with a unique name.

## Workaround in place

`packages/forgetti/src/next/emit/index.ts` emits the proposed form. Tests in `packages/forgetti/test/next/emit/` check it, including the throw-and-retry cases.

## Decision

