# Outcome: fix-escaping-closure

## Built

- `packages/forgetti/src/next/ownership/walk.ts` (`evaluateCall`): calling a fresh closure mutates what the closure captures only when its body changes a captured fresh value. Its arguments are still marked as mutated. Before, every call counted, so a helper called twice in render bailed the unit.
  A closure that passes a captured fresh value (or a value holding one, through an alias, a spread or an array) to a call that is not a known pure global also counts as mutating when it is called (`Created.passes`, `isPassingValue`, `isCapturedPass`). This was added after review: a module function or a local helper that changes a captured object through an argument made `PassSink` and `PassAdd` differ.
- `packages/forgetti/src/next/plan/baseline.ts`:
  - `isReadOnlyUse` accepts an argument of `Object.keys(...)` on the global `Object` (`isObjectKeysCall`), so `errors = validateAll(...)` can be cached when it is only read and passed to `Object.keys`;
  - `isStableOuter` returns false for a binding that any code writes, so a module `let` that render assigns is not a stable input.
- `packages/forgetti/test/next/eligibility/escaping-closure.test.ts`: 8 tests, 5 of them for cases that still bail (stale read described in a comment).
- `benchmarks/corpus/tuning/escaping_closure/`: `Rows`, `Pair`, `Check` (local helpers called several times, `Object.keys` on a call result).
- `nodes/fix-escaping-closure/probes/`: soundness probes (not in a corpus set).

## Proof

- base: `a00b9fa`, `pnpm --filter compare table --set heldout --case form_validation`: `SignupForm` bails as `escaping-closure`, next compiled 1/2, work (React) 72, React Compiler 25. The smallest component that bails is in `log.md`.
- branch: same command: compiled 2/2, work 25 (React Compiler 25), step by step identical to React Compiler (renders and computes). Preact 25 against uncompiled 72.

Work per file (React, next), before, after, React Compiler: `heldout/form_validation` 72, 25, 25. `tuning/escaping_closure` 21 (uncompiled, the case is new), 11, 11. No other file in `base`, `tuning` or `heldout` changed in work or gzip (checked on 46 files with the table output before and after). Totals: React 431 before (with the new case), 374 after, React Compiler 535. Preact 355 after.

Gzip (next, React): total 38027 against React Compiler 47458 (0.801). Changed: `heldout/form_validation` 1866 to 2559 (React Compiler 2995, ratio 0.855), `tuning/escaping_closure` 701 to 1054 (1470). Only `heldout/tree_view` is above 1.15 times React Compiler (2046 against 1634, 1.252, unchanged, owned by `tree-view-size`).

## Deviations

- The brief owns `eligibility/**`, but the `escaping-closure` rule lives in `ownership/walk.ts` (`eligibility` skips it, see its comment). Edited there, one condition in `evaluateCall`.
- `plan/baseline.ts` changed in two places (`Object.keys` read-only use, module `let` as an unstable outer). Both were needed: the first to reach React Compiler's work on `form_validation`, the second because the fix exposed an unsound case (probe `HelperTick`) that the bailout used to hide.
- `tuning/escaping_closure` has no scenario where one input changes per call (`one_name`, `new_left`): React Compiler wins those and next cannot match it without per-call keys.
- Tests for the ownership change sit in `test/next/eligibility/` (the owned folder) and not in `test/next/ownership/`.

## Stubs left

- None.

## Gotchas

- `isStableOuter` treated a module `let` initialised with a literal as stable even when render assigns it. `isPlainInput` checked writes first, `getBindingDeps` did not.
- A block that calls a local helper is keyed on the helper's identity and its arguments. A helper that reads state not in its inputs must stay uncached, or its calls go stale.
- The compare harness hides `console` output in vitest. Throw an error with the text to read it.

## Proposed learnings

- Calling a closure is a mutation only when its body changes a captured value or its arguments | a read-only helper called twice leaves the group frozen | packages/forgetti/src/next/ownership | yes (`escaping-closure.test.ts`)
- A module binding that any code writes is never a stable input | a cached closure or block would keep the first value | packages/forgetti/src/next/plan | yes (`escaping-closure.test.ts`)

## Verification

- `pnpm --filter forgetti test`: 24 files, 534 tests pass.
- `rtk proxy pnpm lint`: 0 errors (warnings as before). `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout`: soundness PASS on React and Preact (0 differences), gzip total PASS (0.801), compiled share PASS (30/31 against 19/38). Work and per-file lines FAIL only on the old rule (against forgetti 0.8) and `tree_view` gzip. By amendment-1 no file is above React Compiler in work.
- After review: `Pass*` probes (module function, local closure, method of an object, two helpers deep, spread argument, alias, and a pure-global read that stays compiled) run on both targets with 0 differences. `pnpm --filter forgetti test`: 541 tests pass. `form_validation` stays at work 25.
- Probes (`probes/`, 12 components: helper reading a changing global, ref, state and prop, helper that mutates a capture or its argument, closure stored in a ref, passed to an effect, assigned to an outer variable, returned from a hook helper, called later after a re-render): 0 differences on both targets.
- Known unchecked: the per-file work against React Compiler was derived from the table output (there is no direct flag), not from the gate.

## Size

- Estimated M, actual M.
