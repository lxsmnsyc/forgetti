# Outcome: contracts

## Built

- `packages/forgetti/src/next/ir.ts`: phase-ir types, typechecked against `oxc-parser` 0.159.0.
- `packages/forgetti/src/next/index.ts`: compiler-api types and the stub `compile(code, options)`. It parses with `parseSync` (`preserveParens: false`), throws on a parse error, and returns the input with `map: null`, no diagnostics and a `units` list from a text scan.
- `packages/forgetti/runtime/next.ts`: `EMPTY`, `useCache`, `branch`, `keep`, with real implementations.
- `packages/forgetti/src/next/ownership/index.ts`: stub `analyzeOwnership(scope, unit)` returning no groups.
- `packages/forgetti/src/next/plan/index.ts`: `PlanPass` type, `passes` (typed list: `baseline`, `groups`, `branches`, `loops`) and `runPlanPasses(scope, ownership, plan)`.
- `packages/forgetti/src/next/plan/{baseline,groups,branches,loops}.ts`: identity pass stubs, one per planner node (`baselinePass`, `groupsPass`, `branchesPass`, `loopsPass`). Each planner node replaces only its own file.
- `packages/forgetti/test/next/fixtures/{ternary,derived,map}.plan.ts`: each exports `source` and `plan`, matching `proof-t2/hand/*.jsx`. `fixtures/range.ts` holds `findRange` and `findSpan`, which compute UTF-16 ranges from text.
- `packages/forgetti/test/next/api.test.ts`: 17 tests. Stub behavior, a non-ASCII parse error offset, plan fixture invariants, stubs, runtime basics.
- `packages/forgetti/package.json`: dependencies `oxc-parser` 0.159.0, `magic-string` 1.4.5. Dev dependencies `react` and `react-dom` 19.3.1, `preact` 11.2.0, `happy-dom` 21.0.4, `@types/react` and `@types/react-dom` 19.3.0. `vitest.config.ts` uses `environment: 'happy-dom'`.
- `oxlint.config.ts`: the 0.8 exemption now covers `src/core/**` and `src/index.ts` only.
- Nothing in `src/next/` or `runtime/next.ts` is exported from `package.json`.

## Deviations

- Created `src/next/plan/{baseline,groups,branches,loops}.ts`. The brief owns only `plan/index.ts`, but "each entry imports its own file" needs the files to exist.
- `oxlint.config.ts`: added an ignore for `docs/roadmaps/**/evidence/**` (compiler output kept as produced, it produced about 100 lint errors) and an override that turns off `import/prefer-default-export` for `packages/forgetti/src/next/**` (the stubs have one named export each).
- `pnpm-lock.yaml` changed by the dependency install.
- Contract clarifications are listed in "Frozen contracts" below.

## Stubs left

- `compile()` returns the input unchanged. `scope`, `eligibility`, `emit` and the node that wires them replace it.
- `analyzeOwnership()`: the `ownership` node.
- The four plan passes: `s1-baseline` (`baseline`), and the groups, branches and loops planner nodes.

## Gotchas

- `pnpm lint` still exits non-zero on this branch because of files outside this node: `packages/vite/src/index.ts`, `packages/rollup/src/index.ts`, `examples/*/vite.config.js`. No file under `src/next/`, `runtime/next.ts` or `test/next/` has a lint error.
- Do not run `pnpm format` on the whole repo: it rewrites files under `docs/`. Format with `pnpm exec oxfmt <paths>`.
- The `compile()` stub scan uses ASCII component filters (`^[A-Z]`), so `Étiquette` is not a component.
- oxc-parser `errors` can hold warnings. Filter on `error.severity.toString() === 'Error'`; comparing to the `Severity` const enum fails the linter.
- `keep` needs one lint-disable for `stored as T`. Keep it.
- Comments for `@forgetti skip` come from `parseSync(...).comments`.
- The ternary fixture needs emit to lower the conditional to `if`/`else` so branch blocks can run inside an arm. See the `at` rule below.
- Fixture binding ids: ternary ok 0, a 1, b 2. derived a 0, b 1, x 2, y 3, z 4. map items 0, title 1, item 2.

## Proposed learnings

- Format with `oxfmt <paths>`, never the whole repo | the repo script touches `docs/` | root | no

## Verification

- `pnpm --filter forgetti test`: pass, 5 files, 67 tests.
- `pnpm --filter forgetti typecheck`: pass.
- `pnpm lint`: no errors in this node's files. The command exits 1 on the files named under Gotchas.
- `pnpm exec oxfmt` on this node's files: clean.

## Size

- Estimated M, actual M.

## Frozen contracts

The orchestrator copies each block below into `contracts/<name>.md`.

### contracts/compiler-api.md

~~~~markdown
---
name: compiler-api
version: 1
status: frozen
defined_by: contracts
---

# Contract: compiler-api

## Purpose

The public entry point of the new compiler. The harness, the vite and rollup plugins and the tests call it. Lives in `packages/forgetti/src/next/index.ts`.

## Interface

```ts
// Same shapes as 0.8 (`packages/forgetti/src/core/presets.ts`), so plugin options keep working.
export type ImportDefinition =
  | { kind: 'named'; name: string; source: string }
  | { kind: 'default'; source: string };

// Serializable, as in 0.8. Plugins pass presets through JSON-like config.
export interface RawRegExp { source: string; flags: string }

export type HookType =
  | 'ref'           // useRef: the result is a stable object
  | 'memo'          // useMemo: the callback runs only when deps change; the result is opaque
  | 'callback'      // useCallback: the result is opaque
  | 'effect'        // useEffect, useLayoutEffect, useInsertionEffect: the callback never runs during render
  | 'state'         // useState, useReducer: [value, setter]; value is opaque and never mutated, setter is stable
  | 'use'           // use(): may be called in branches and loops, never cached
  | 'effect-event'; // useEffectEvent: the result is never an input of any slot

export interface Preset {
  filters: { component: RawRegExp; hook?: RawRegExp };
  runtime: { useRef: ImportDefinition };
  imports: {
    hooks: (ImportDefinition & { type: HookType })[];
    // HOCs whose first argument is a component, such as memo and forwardRef.
    hocs: ImportDefinition[];
  };
}

export interface CompileOptions {
  preset: 'react' | 'preact' | Preset;
  filename: string;
  sourceMap?: boolean;
}

export type BailoutReason =
  | 'mutates-props'
  | 'mutates-state'
  | 'mutates-hook-argument'
  | 'stores-fresh-in-ref'
  | 'stores-fresh-in-module'
  | 'returns-fresh-from-hook'
  | 'escaping-closure'
  | 'conditional-hook'
  | 'unsupported-syntax';

export interface Diagnostic {
  unit: string; // component or hook name
  reason: BailoutReason;
  start: number; // UTF-16 index into the input
  end: number;
  message: string;
}

export interface CompileResult {
  code: string;
  map: import('magic-string').SourceMap | null;
  diagnostics: Diagnostic[];
  // Every component and hook found, compiled or not, for the bailout-rate gate.
  units: { name: string; compiled: boolean }[];
}

export function compile(code: string, options: CompileOptions): CompileResult;
```

## Behavior

- Pure function of its inputs. It never throws on valid JS, JSX or TS.
- `oxc-parser`'s `parseSync` does not throw. When its `errors` array holds an entry with severity `Error`, `compile()` throws an `Error` whose message is `<first error message> (at <first label start>)`. Entries with other severities are ignored.
- Comments, needed for `@forgetti skip`, come from `parseSync`'s `comments` array. The `Program` node does not carry them.
- Every offset (`Diagnostic.start`, `Diagnostic.end`, `Range`) is a UTF-16 code unit index into the input string, as oxc-parser and magic-string use. Not a byte offset.
- `compile()` parses with `preserveParens: false`.
- A unit that bails out is left byte for byte as it was, and gets one `Diagnostic`.
- Code outside components and hooks is not changed, except for added imports.
- `/* @forgetti skip */` before a unit leaves it uncompiled with no diagnostic, like 0.8.

## Stub

`contracts` ships `compile()` returning the input unchanged, with `map: null` and `units` filled from a text scan, so the harness can run before any phase exists. The scan lists `function Name` declarations and `const Name = function | arrow` declarations whose names match the preset filters. The `'react'` and `'preact'` presets use `^[A-Z]` for components and `^use[A-Z0-9]` for hooks, so a name that starts with a non-ASCII capital is not a component. Every listed unit has `compiled: false`.

## Contract tests

`packages/forgetti/test/next/api.test.ts`.

## Changes

- v1: initial, frozen by `contracts`. Parse error message format, severity filter, stub scan and lint-style array types are the only differences from the draft.

~~~~

### contracts/runtime-api.md

~~~~markdown
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

~~~~

### contracts/phase-ir.md

~~~~markdown
---
name: phase-ir
version: 1
status: frozen
defined_by: contracts
---

# Contract: phase-ir

## Purpose

The data each phase hands to the next. Lives in `packages/forgetti/src/next/ir.ts`. Every phase is a pure function from the previous phase's data to its own. Only `emit` writes code.

## Interface

```ts
import type { Program, Function as OxcFunction, ArrowFunctionExpression, IdentifierReference } from 'oxc-parser'; // oxc-parser re-exports @oxc-project/types

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
  mutations: { range: Range; scope: number }[];
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
  // Root and iteration nodes: the block's code is inserted before the statement that holds `at`.
  // Branch nodes: `at` is the arm, and the code goes inside the arm, which emit lowers to a
  // statement list (an `if`/`else` built from the conditional, switch or logical expression).
  // In both cases each output's range is replaced by its local, and the local is declared with
  // `let` in the inserted code.
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
- Output ranges of different blocks in one node may nest, when the outer block reads the inner block's output through a `ValueRef` of kind `output`. The inner block has the lower `first`. Emit moves the outer expression's text with the inner range already replaced by its local.
- Binding ids in fixtures follow the order the bindings are declared: parameters first, then locals in source order.

## Stub

`contracts` ships the types, a stub `analyzeOwnership()` and a `PlanPass` list with one empty pass each for `baseline`, `groups`, `branches` and `loops`, plus hand-written `CachePlan` fixtures for `ternary.jsx`, `derived.jsx` and `map.jsx` in `packages/forgetti/test/next/fixtures/`. Together they cover a branch node, an iteration node and a `keep` block, so `emit` can be built before the planner exists.

## Contract tests

Type-level only. Each phase's own tests check its output against this shape.

## Changes

- v1: initial, frozen by `contracts`. Branch `at` rule, nested outputs and slot counting are clarified. `Binding.imported.name` is a plain string.

~~~~

