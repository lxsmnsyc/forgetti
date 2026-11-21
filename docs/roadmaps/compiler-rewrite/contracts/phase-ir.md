---
name: phase-ir
version: 1
status: draft
defined_by: contracts
---

# Contract: phase-ir

## Purpose

The data each phase hands to the next. Lives in `packages/forgetti/src/next/ir.ts`. Every phase is a pure function from the previous phase's data to its own. Only `emit` writes code.

## Interface

```ts
import type { Program, Function as OxcFunction, ArrowFunctionExpression, IdentifierReference } from 'oxc-parser';

export interface Range { start: number; end: number }

// Phase 1: parse and scope
// A lexical scope inside a unit. Branch and loop scopes let eligibility find conditional hooks.
export interface Scope {
  id: number;
  parent: number | null;
  kind: 'unit' | 'function' | 'block' | 'branch' | 'loop' | 'catch';
  range: Range;
}
export interface Reference {
  range: Range;
  write: boolean;
  node: IdentifierReference;
  scope: number;
  // Set when the reference sits inside a nested function of the unit.
  closure?: number;
}
export interface Binding {
  id: number;
  name: string;
  kind: 'param' | 'const' | 'let' | 'var' | 'function' | 'class' | 'import' | 'catch';
  declaration: Range;
  scope: number;
  references: Reference[];
  // Set for import bindings.
  imported?: { source: string; name: string | 'default' | '*' };
}
export interface Unit {
  id: number;
  kind: 'component' | 'hook';
  name: string;
  node: OxcFunction | ArrowFunctionExpression;
  skip: boolean; // `/* @forgetti skip */`
}
export interface ScopeResult {
  program: Program;
  units: Unit[];
  bindings: Binding[];
  scopes: Scope[];
  // Keyed by node identity.
  bindingOf(node: IdentifierReference): Binding | undefined;
}

// Phase 2: eligibility
export type Eligibility =
  | { unit: number; ok: true }
  | { unit: number; ok: false; reason: import('./index').BailoutReason; range: Range; message: string };

// Phase 3: ownership
export interface Group {
  id: number;
  members: number[]; // binding ids that may point at the group's fresh value
  created: Range[];
  // Statements or calls that mutate any member, in source order, with the scope they run in.
  // A mutation in a loop scope repeats, so the group stays fresh until the loop's range ends.
  mutations: Array<{ range: Range; scope: number }>;
  frozenAt: number; // index after the last mutation, extended to the end of any loop that holds one
  inputs: number[]; // binding ids of the group's non-fresh inputs (props, state, hook results)
}
export interface OwnershipResult { unit: number; groups: Group[]; opaque: number[] }

// Phase 4: cache-tree plan
export type ValueRef =
  | { kind: 'binding'; id: number }
  | { kind: 'output'; block: number; index: number };
export interface Output { range: Range; local: string }
export interface SlotBlock {
  id: number;
  // value: inputs then outputs. keep: one slot holding an array passed through runtime keep().
  kind: 'value' | 'keep';
  first: number; // index of the first slot in its cache node
  inputs: ValueRef[];
  outputs: Output[];
  // The block's code is inserted before the statement that holds `at`. Each output's range is
  // replaced by its local, and the local is declared with `let` in the inserted code.
  at: Range;
}
export interface CacheNode {
  kind: 'root' | 'branch' | 'iteration';
  range: Range;
  size: number;
  blocks: SlotBlock[];
  children: CacheNode[];
  // For branch and iteration nodes: the slot index in the parent.
  parentIndex?: number;
  // Branch nodes: the arm this cache serves (consequent, alternate, a switch case or a logical right side).
  arm?: Range;
  // Iteration nodes: the loop body or callback body. When the source has no index,
  // emit declares a counter local named by `indexLocal`.
  body?: Range;
  indexLocal?: string;
}
export interface CachePlan { unit: number; root: CacheNode }
```

## Behavior

- Ranges are UTF-16 indices into the original source. `emit` edits only at these ranges.
- A child node's range lies inside its parent's. Blocks inside one node do not overlap. `emit` applies edits from the innermost node out, so magic-string never sees two edits at one range in the wrong order.
- A unit with `ok: false` gets no ownership result and no plan.
- Every block's inputs are compared with `Object.is`, and a block holds `inputs.length + outputs.length` slots.

## Stub

`contracts` ships the types only, plus hand-written `CachePlan` fixtures for `ternary.jsx`, `derived.jsx` and `map.jsx` in `packages/forgetti/test/next/fixtures/`. Together they cover a branch node, an iteration node and a `keep` block, so `emit` can be built before the planner exists.

## Contract tests

Type-level only. Each phase's own tests check its output against this shape.

## Changes

- v1: initial.
