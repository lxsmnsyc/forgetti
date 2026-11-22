---
name: phase-ir
version: 4
status: frozen
defined_by: contracts
---

# Contract: phase-ir

## Purpose

The data each phase hands to the next. Lives in `packages/forgetti/src/next/ir.ts`. Every phase is a pure function from the previous phase's data to its own. Only `emit` writes code.

## Interface

```ts
import type { Program, Function as OxcFunction, ArrowFunctionExpression, IdentifierReference, JSXIdentifier } from 'oxc-parser'; // oxc-parser re-exports @oxc-project/types

export interface Range { start: number; end: number }

// Phase 1: parse and scope
// A lexical scope. Scope 0 is the module. Branch and loop scopes let eligibility find conditional hooks.
export interface Scope {
  id: number;
  parent: number | null;
  kind: 'module' | 'unit' | 'function' | 'block' | 'branch' | 'loop' | 'catch';
  range: Range;
}
export interface Reference {
  range: Range;
  write: boolean;
  node: IdentifierReference | JSXIdentifier; // a JSX tag name such as `<Child />` is a reference
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
  imported?: { source: string; name: string }; // `name` is 'default' or '*' for those imports
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
  bindingOf(node: IdentifierReference | JSXIdentifier): Binding | undefined;
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
  mutations: { range: Range; scope: number }[];
  frozenAt: number; // index after the last mutation, extended to the end of any loop that holds one
  inputs: number[]; // binding ids of the group's non-fresh inputs (props, state, hook results)
}
export interface OwnershipResult {
  unit: number;
  groups: Group[];
  opaque: number[];
  // Set when ownership finds a bailout (`escaping-closure`). The unit then gets no plan,
  // as for an `ok: false` entry from eligibility.
  bailout?: Extract<Eligibility, { ok: false }>;
}

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
  // Root and iteration nodes: the block's code is inserted before the statement that holds `at`.
  // Branch nodes: `at` is the arm, and the code goes inside the arm, which emit lowers to a
  // statement list (an `if`/`else` built from the conditional, switch or logical expression).
  // In both cases each output's range is replaced by a read of its value slot, such as `$[1]`.
  // `Output.local` names a temporary only when a value block has more than one output: all
  // values are computed into their locals before any slot is written.
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
- Every block's inputs are compared with `Object.is`. A `value` block holds `inputs.length + outputs.length` slots. A `keep` block has no inputs, one output and one slot. A child node holds one slot in its parent, at `parentIndex`. `size` is at least the sum, and a gap is allowed.
- Output ranges of different blocks in one node may nest, when the outer block reads the inner block's output through a `ValueRef` of kind `output`. The inner block has the lower `first`. Emit moves the outer expression's text with the inner range already replaced by its slot read.
- A `ValueRef` of kind `output` reads the same slot as the output's range.
- Binding ids in fixtures follow the order the bindings are declared: parameters first, then locals in source order.

## Stub

`contracts` ships the types, a stub `analyzeOwnership()` and a `PlanPass` list with one empty pass each for `baseline`, `groups`, `branches` and `loops`, plus hand-written `CachePlan` fixtures for `ternary.jsx`, `derived.jsx` and `map.jsx` in `packages/forgetti/test/next/fixtures/`. Together they cover a branch node, an iteration node and a `keep` block, so `emit` can be built before the planner exists.

## Contract tests

Type-level only. Each phase's own tests check its output against this shape.

## Changes

- v1: initial, frozen by `contracts`. Branch `at` rule, nested outputs and slot counting are clarified. `Binding.imported.name` is a plain string.
- v2: outputs are read from their value slot instead of a `let` local (change request from `emit`, accepted 2026-11-22). The `let` form made ternary and derived 22% larger than the hand output.
- v3: scope 0 has kind `module`, and `Reference.node` may be a `JSXIdentifier` (change request from `parse-scope`, accepted 2026-11-22).
- v4: `OwnershipResult.bailout` carries the `escaping-closure` bailout. `compile()` reports it as a diagnostic and does not plan the unit (change request from `ownership`, accepted 2026-11-22). Until `ir.ts` adds the field, `ownership/index.ts` exports it as `OwnershipReport`.
