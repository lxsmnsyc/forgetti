# Change request: phase-ir v3 to v4

- From node: ownership
- Status: accepted

## Problem

The brief says ownership reports the `escaping-closure` bailout as an `Eligibility`. `OwnershipResult` has no field for it, and `analyzeOwnership()` returns only `OwnershipResult`. `compile()` calls `analyzeOwnership()` (see `nodes/planner-groups/brief.md`), so a unit that should bail would still be planned and compiled. The gate corpus has no unit that bails this way, so nothing would catch it.

## Proposed change

```ts
export interface OwnershipResult {
  unit: number;
  groups: Group[];
  opaque: number[];
  // Set when ownership finds a bailout (`escaping-closure`). The unit then gets no plan,
  // as for an `ok: false` entry from eligibility.
  bailout?: Extract<Eligibility, { ok: false }>;
}
```

Behavior: "A unit with `ok: false` gets no ownership result and no plan" also covers an ownership result with `bailout` set: `compile()` reports it as a diagnostic and does not plan the unit.

## Affected nodes

- `ownership` (produces it).
- `planner-groups` and the node that wires `compile()` (must check `bailout` before planning).

## Workaround in place

`packages/forgetti/src/next/ownership/index.ts` returns `OwnershipReport`, which is `OwnershipResult` plus `bailout?`. `ir.ts` is not edited. When v4 lands, `OwnershipReport` becomes the same as `OwnershipResult`.

## Decision

Accepted 2026-11-22 by the orchestrator after the fresh review of `ownership`. phase-ir is now v4. The node that wires `compile()` moves the field into `ir.ts` and drops `OwnershipReport`.
