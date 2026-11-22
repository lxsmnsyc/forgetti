---
name: corpus-format
version: 1
status: frozen
defined_by: harness
---

# Contract: corpus-format

## Purpose

How a corpus case is written so the harness can compile, run and score it. Used by `corpus-tuning`, `corpus-heldout` and every gate. The harness is `benchmarks/compare`.

## Interface

Each case is a folder `benchmarks/corpus/<set>/<name>/` with these files.

`input.jsx` or `input.tsx`:

- One or more components or hooks, in the 0.8 and React Compiler dialect: plain `react` imports and JSX.
- It imports the counted helpers from `'../../shared/counter.js'`: `bump(key)`, `Child`, `Row` and `Btn`. `Child` and `Row` render one element each, `Btn` is a `memo` component. Each call to `bump(key)` or render of a counted component adds 1 to a counter under its key.
- Imports from `react` use the named form `import { ... } from 'react'`. The harness rewrites them for Preact.
- Do not format it. Its bytes are measured.

`scenarios.js`:

```js
export default [
  {
    name: 'one_b',            // scenario name, unique in the case
    component: 'Derived',     // export of input.* to render, default: `name`
    props: { a: 1, b: 2 },    // object, or a function returning one (called once per use)
    context: { name: 'Ctx', value: 'A' }, // optional: export that is a context, and its value
    wrap: (h, element) => element,        // optional: wraps the element, `h` is the target's createElement
    steps: [
      { name: 'update', props: { a: 1, b: 3 } },    // renders new props
      { name: 'again' },                            // no props and no act: renders the same props again
      { name: 'to_B', context: 'B' },               // sets a new context value, then renders
      { name: 'click', act: ({ mod, startTransition }) => {} }, // runs inside act()
    ],
  },
];
```

- A scenario mounts with `props` and `context.value`, then runs its steps in order on the same root. The mount is reported as the step `(mount)`.
- Counters reset after the mount and before every step. A step reports the counts of its own work.
- A step with `props` renders them. A step with neither `props` nor `act` renders the previous props again. A step with `act` runs the function inside the target's `act()`, after rendering if it also has `props`.
- `act` may call `startTransition`, resolve a promise, or call a setter that the input exports or stores on `globalThis`. On Preact `startTransition` runs its callback at once.
- Props objects and factories are shared by every compiler and target in one run. A case that mutates its props uses factories.
- `benchmarks/corpus/shared/scenarios.js` exports `phases(component, base, variants, { context?, state? })`, which builds one scenario per variant (mount `base`, one update step named like the variant) plus a `same` scenario that renders the same props again.

`meta.json`:

```json
{ "source": "<url or 'written'>", "license": "<SPDX id or 'n/a'>", "targets": ["react", "preact"] }
```

Sets: `base` (the 15 debate files), `tuning`, `heldout`. `heldout` is read only by `corpus-heldout` and `final-gate`.

## Behavior

- The harness compiles each input with uncompiled, forgetti 0.8.5, React Compiler 1.0.0 and the new compiler, and runs it on React 19.3.1 and Preact 11.2.0. React Compiler runs on React only. A case runs only on the targets in its `meta.json`.
- For Preact the harness rewrites imports from `react` before compiling: `use`, `memo`, `forwardRef` and the other names that only `preact/compat` exports come from `preact/compat`, other `use*` names from `preact/hooks`, the rest from `preact`.
- A step matches uncompiled output when its HTML (`container.innerHTML`) and its error message are equal. A step that throws, or a case that fails to compile or load, is a difference.
- Renders are counts of the counted components `Child`, `Row` and `Btn`. Recomputes are every other counter key, such as `bump('total')`. The work of a case is renders plus recomputes over its update steps. The mount is not counted.
- Bytes are the raw and gzip size of the compiler's output before JSX lowering. Slots are the sum of the sizes in the emitted cache calls. A unit is a component or hook, and a bailout is a unit the compiler left uncompiled.

## Stub

The 15 files of `debate/evidence/corpus/` converted by `harness` to `benchmarks/corpus/base/`, with the scenarios of `debate/evidence/runtime.mjs` and `extra.mjs`.

## Contract tests

`pnpm --filter compare test` runs the harness on `base` and requires, for uncompiled output, no errors and the same HTML on React and Preact, and for the new compiler 0 differences.

## Changes

- v1: initial, frozen by `harness`. Adds `component`, object `context`, `wrap(h, element)`, step `context`, function props, the `(mount)` step and the `phases()` helper to the draft. Defines value comparison as HTML plus error.

