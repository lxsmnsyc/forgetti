# Outcome: harness

## Built

The package `benchmarks/compare` (name `compare`, private, ignored by changesets) compiles every corpus case with uncompiled, forgetti 0.8.5, React Compiler 1.0.0 and the new compiler. It runs the scenarios on React 19.3.1 and Preact 11.2.0 under happy-dom.

Commands, run from the repo root:

- `pnpm --filter compare table [--set <name>]... [--compiler <name>]... [--case <name>]...` prints the compile table (raw bytes, gzip bytes, slots, compile ms, units compiled, bailouts, per case, compiler and target), then one row per scenario step with renders (`r`), recomputes (`c`) and a `DIFF` flag when the HTML differs from uncompiled, then the number of differing steps and files per compiler.
- `pnpm --filter compare gate [--set <name>]...` prints PASS or FAIL for each threshold of `debate/debate.md` "Hypothesis" and exits 1 when any fails. The default set is `base`. Sets are repeated or comma separated.
- `pnpm --filter compare test` runs vitest: 9 tests in `test/base.test.ts`, `test/soundness.test.ts` and `test/gate.test.ts`. About 4 seconds.

Files:

- `benchmarks/compare/src/`: `cli.ts`, `collect.ts` (compile and run every cell), `compilers.ts` (four compilers, Preact import retargeting, JSX lowering), `run.ts` (module writing, happy-dom, React and Preact drivers, scenario runner), `loader.ts` (a Vite SSR server that loads TypeScript and compiled modules), `corpus.ts`, `metrics.ts`, `report.ts`, `gate.ts`, `types.ts`.
- `benchmarks/compare/baseline/compile.json` and `runtime.json`: the numbers of `debate/evidence/out/` for React Compiler and forgetti 0.8, in the format the tests read.
- `benchmarks/compare/vendor/forgetti-0.8.5.tgz`: the npm tarball of forgetti 0.8.5, installed as the dependency `forgetti-0.8`.
- `benchmarks/corpus/base/<name>/{input.jsx,scenarios.js,meta.json}`: the 15 debate files. `benchmarks/corpus/shared/counter.js` is the debate's counter. `benchmarks/corpus/shared/scenarios.js` exports `phases()`, a helper that builds the usual "mount, then one update" scenarios.
- The scenarios of the debate's `extra.mjs` are in the corpus: `usectx` has `context_change`, `forloop` has `grow_shrink`.

How the gate checks each threshold:

- Soundness: every step of the new compiler, mount included, has the same HTML and the same error as uncompiled output. Checked on both targets.
- Work: renders plus recomputes over the update steps (the mount is not counted). Counter keys `Child`, `Row` and `Btn` are renders and every other key is a recompute. Per target, the total of the new compiler must be strictly below each baseline that runs on that target, and no case above the lower baseline. On Preact the only baseline is forgetti 0.8. A step that throws is charged as the uncompiled step.
- Size: gzip bytes of the compiled code on React, total at most 1.0 times React Compiler, each case at most 1.15 times.
- Compiled share: compiled units over all units on React, at least React Compiler's. It is computed on `heldout` cases when `heldout` is among the chosen sets, else on all chosen cases.

Current result on `base` with the stub compiler: soundness passes, size passes (stub output is unchanged source), work and compiled share fail, so `gate` exits 1.

## Proof

Not a fix node.

## Result

Not an experiment node.

Baseline match on `base` (checked by `test/base.test.ts`, exact equality, no tolerance needed):

- Raw bytes, gzip bytes and slots of React Compiler and forgetti 0.8 equal `compile-table.json` for all 15 cases.
- Renders and recomputes of uncompiled, React Compiler and forgetti 0.8 equal `runtime-results.json` for every phase on React.
- React Compiler has 0 differences and compiles 14 of 15 files (`bailout` fails).
- forgetti 0.8 differs from uncompiled output on 3 files: `bailout` (`same`), `forloop` (`deep_item`, `grow`, `shrink`) and `usectx` (`to_B`). That is the debate's 3 differences.
- Compile ms are measured the same way (median of 20 runs after the first) and vary with the machine. They are not tested.

## Deviations

- `oxfmt.config.ts` (outside the owned paths): added `benchmarks/corpus/**/input.*` and `benchmarks/corpus/shared/counter.js` to `ignorePatterns`. Formatting a corpus file changes the bytes the harness measures. Formatted `bailout/input.jsx` grew from 287 to 306 raw bytes for React Compiler.
- `.changeset/config.json` (shared): `ignore` gains `compare`.
- `pnpm-workspace.yaml`: `packages` gains `benchmarks/compare`. Root `pnpm build`, `pnpm test` and `pnpm typecheck` only run `./packages/*`, so they do not run this package.
- forgetti 0.8.5 is vendored as a tarball (142 KB) instead of an `npm:forgetti@0.8.5` alias. pnpm links any dependency named `forgetti` at version 0.8.5 to the workspace package because `linkWorkspacePackages` is on, even with an `npm:` alias or a registry tarball URL. After `switch` the workspace package changes, so the link would break. A `file:` tarball is not linked.
- The corpus-format contract gains fields the draft did not have (see the frozen text): `component`, `context` as an object, `wrap(h, element)`, `act(context)` argument, props as factories, step-level `context`, and a `(mount)` step. The draft's `{ name, props, context?, wrap?, steps }` still holds.
- The draft says "HTML and value log must match". The harness compares the HTML and the error message of each step. There is no separate value log.

## Stubs left

- `next` compiles nothing yet, so its numbers equal uncompiled. `emit` and later nodes change that.
- The harness maps any import of `forgetti` or `forgetti/<path>` in new-compiler output to `packages/forgetti/runtime/next.ts` (`src/loader.ts`, `NEXT_RUNTIME`). `emit` must emit imports of that form. If `emit` uses another specifier, change that one function.
- The slot count of the new compiler is read from emitted text with the pattern `useCache(<name>, N)` and `branch(<name>, <expr>, N)` (`SLOT_PATTERNS.next` in `src/compilers.ts`). Names with an alias prefix such as `_useCache` match. Change the pattern if emit names them differently.
- `benchmarks/corpus/tuning/` and `heldout/` do not exist. `corpus-tuning` and `corpus-heldout` add them. The harness reads a set only when asked, so `heldout` stays closed until `final-gate` runs `gate --set heldout`.
- `.tsx` inputs are supported (Babel `preset-typescript`) but no base case uses one, so that path has no test.

## Gotchas

- Run `pnpm install` after pulling this node. It adds the package `compare` and its dependencies, and updates `pnpm-lock.yaml`.
- Format with `pnpm exec oxfmt <paths>`, but corpus `input.*` files are ignored on purpose. Write them by hand in the compact style of the debate files, and do not reformat them.
- The inputs import the counter as `'../../shared/counter.js'`. The harness rewrites that to `./counter.js` before compiling and copies the counter next to each compiled module, so every compiler and target has its own counters.
- On Preact, the harness rewrites `import { ... } from 'react'` in the input before compiling. Names `use`, `memo`, `forwardRef`, `startTransition`, `useTransition`, `useDeferredValue`, `useSyncExternalStore`, `useInsertionEffect`, `Suspense`, `lazy` and `PureComponent` come from `preact/compat`. Other `use*` names come from `preact/hooks`. Everything else (`createContext`, `createElement`, `Fragment`) comes from `preact`. Only the named-import form `import { ... } from 'react'` is rewritten.
- On Preact `startTransition` in `act(context)` runs its callback at once. Preact core has no transitions.
- React Compiler runs on React only. Its Preact cells are absent, not zero.
- The new compiler loads from source through a Vite SSR server, so no build is needed. A syntax error in `packages/forgetti/src/next/` shows as a failed cell (`compile: ...`), and counts as a difference.
- A new compiler cell that fails to compile or load is charged as the uncompiled run in the work totals, so a crash cannot lower the total.
- `pnpm lint` ignores `benchmarks/**` (existing ignore). `pnpm --filter compare typecheck` checks this package.
- Unit counts: React Compiler counts `CompileSuccess` events as compiled and `CompileError` plus `PipelineError` as bailouts. forgetti 0.8 reports every `$$cache(` call as a compiled unit and has no bailouts. The new compiler uses `CompileResult.units` and `diagnostics`.
- `pnpm lint` printed `ESLint output (JSON parse failed ...)` through the shell wrapper on this machine. `oxlint --type-aware` itself exits 0.

## Proposed learnings

- Never format files under `benchmarks/corpus/**/input.*` | their bytes are measured | benchmarks/corpus | no
- Keep forgetti 0.8.5 as the vendored tarball in `benchmarks/compare/vendor` | pnpm links a same-named, same-version dependency to the workspace | benchmarks/compare | no

## Verification

- `pnpm --filter compare test`: pass, 3 files, 9 tests.
- `pnpm --filter compare typecheck`: pass.
- `pnpm --filter compare table`: prints both tables for 15 cases in about 4 seconds.
- `pnpm --filter compare gate`: exit 1, with the failing checks named.
- `pnpm --filter forgetti test`: pass, 67 tests.
- `pnpm build`: pass. `oxlint --type-aware`: exit 0. `pnpm format:check`: pass.

## Size

- Estimated M, actual M.

## Frozen contracts

The orchestrator copies the block below into `contracts/corpus-format.md`.

### contracts/corpus-format.md

~~~~markdown
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

~~~~
