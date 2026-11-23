# Outcome: fix-rc-callbacks

## Built

- `packages/forgetti/src/next/plan/baseline.ts`: `walkEager`, `findDeferred` (closures render does not run), `isAssignedReadOnly`. `isPureSyntax` now uses `walkEager`.
- `packages/forgetti/src/next/plan/groups.ts`:
  - a closure is cached on the bindings it captures, alone or inside an element. It is refused when it reads a global that is not stable, wherever it is used, or reads hidden state (`ref.current`, `Math.random`). Only a write such as `globalThis.n = id` is allowed;
  - `member` inputs: `props.x` is an input instead of `props`, for the first parameter of a component. They are off for the whole unit when any use of `props` or `props.x` is not a read (a call argument, a method receiver, a write);
  - a `.map(fn)` on a group member in a JSX child position gets its own block;
  - `name = call(...)` in `try`, `catch` and `finally` is a candidate when `name` is a local that is only assigned and read.
- `packages/forgetti/test/next/plan/callbacks/callbacks.test.ts`: 14 tests.
- `benchmarks/corpus/tuning/callback_globals/` (not owned): `GlobalMap`, `GlobalMemo`, `GlobalPlain` (a closure that reads `globalThis.__g`, called during render, with the global changed between two renders of the same props) and `PropsFill` (a call that fills `props.items` in place). The gate fails on these on `dbb9b78` and passes after the fix.

## Proof

- base: `80da7a4`, `pnpm --filter compare table --set base --case callback|jsxprops|mutate|trycatch`: next work 3, 6, 4, 4 against React Compiler 1, 1, 2, 2. All four reproduced.
- branch: same commands: next 1, 1, 2, 2. Details in `log.md`.

Work per file (React: next before, next after, React Compiler; Preact: next before, next after, uncompiled):

| file | React | Preact |
| --- | --- | --- |
| base/callback | 3, 1, 1 | 3, 1, 3 |
| base/jsxprops | 6, 1, 1 | 6, 1, 6 |
| base/mutate | 4, 2, 2 | 4, 2, 6 |
| base/trycatch | 4, 2, 2 | 4, 2, 4 |

No other file in `base` or `tuning` changed (36 files compared before and after). Totals, `base` plus `tuning`: React 163 to 152 (React Compiler 218), Preact 144 to 133.

## Acceptance

- Four files at or below React Compiler on React and below uncompiled on Preact: pass.
- Soundness: 0 differences on React and Preact, `base` and `tuning`, including `tuning/callback_globals` (the two review probes, a closure over a changing global called by a memo child, a plain child and `items.map(fn)`, and a prop array filled by a call).
- Gzip (with `callback_globals`): 14125 against React Compiler 20444 (0.691, was 0.681), no file above 1.15 times.
- Total work with `callback_globals`: React 160 (React Compiler 219), Preact 141. Without it: React 152 against 218, Preact 133. `callback_globals` is 8 on next, equal to uncompiled. React Compiler and forgetti 0.8 render wrong output on its global steps (marked DIFF), so their work of 1 there is not a bar anyone can meet; the gate's per-file line `callback_globals 8 > 1` is that artifact.
- Fast check: `pnpm --filter forgetti test` 516 pass, `pnpm lint` 0 errors after build, `pnpm format:check` and `pnpm typecheck` pass.
- `pnpm --filter compare gate` still exits 1 on its old per-file rule against forgetti 0.8 (`base/mutate 2 > 1`, `alias_*`, `hook_*` and others). Judged by amendment-1, no file in `base` or `tuning` is above React Compiler on React.

## Deviations

- `packages/forgetti/src/next/ir.ts` (not owned): `ValueRef` gets the `member` variant. Change request in `contracts/phase-ir.members.change-request.md`.
- `packages/forgetti/src/next/emit/index.ts` (not owned): `getInput` renders a `member` input as `name.prop`.
- Change request to fold into the contract: `contracts/phase-ir.members.change-request.md` (the `member` variant of `ValueRef`).
- `benchmarks/corpus/tuning/callback_globals/` (not owned): new corpus case, like `loop_shapes`.
- `loops.ts` and `branches.ts` need no change. `dropCallInputs` leaves `member` inputs in place, which only adds an input.

## Known gaps

- A parent that mutates a prop object in place and re-renders with the same object (for example `props.items.push` outside the component) is not seen by a `member` input. This breaks React's rules, and the destructured form `{ items }` behaves the same on the base batch and in React Compiler. Accepted by the maintainer.

## Stubs left

- None.

## Gotchas

- `member` inputs only apply to the first parameter of a component. Other bindings can be nullish, and the compare would throw where the source reads the property only on a branch.
- The group-map piece only fires when the receiver is a group member. A plain receiver stays with the loops pass.
- `try` candidates only cover statements directly in a `try`, `catch` or `finally` block that sits at the top level of the unit body.
- A closure written as a call argument is still walked for purity, since the callee may run it during render.

## Proposed learnings

- A purity check over a candidate must skip the body of a closure render does not run, and still collect its captured bindings as inputs | a callback body runs on a later event, so a global or a member write in it says nothing about render | packages/forgetti/src/next/plan | yes

## Verification

- `pnpm build`, `pnpm typecheck`, `pnpm format:check`: pass.
- `rtk proxy pnpm lint`: 0 errors.
- `pnpm --filter forgetti test`: 22 files, 520 tests, pass.
- `pnpm --filter compare gate --set base --set tuning`: soundness PASS both targets, gzip PASS, work lines FAIL against forgetti 0.8 as before.

## Size

- Estimated M, actual M.
