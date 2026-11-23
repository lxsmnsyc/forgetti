# Outcome: fix-rc-children

## Built

- `packages/forgetti/src/next/plan/baseline.ts`:
  - `isStableOuter` accepts a module `const` made by `memo(x)` (one argument) or `forwardRef(fn)` when the callee is imported as `memo` or `forwardRef` (the exported name, not the local alias) from `react` or `preact/*`, or is `X.memo` on a default or namespace import of those packages, the binding is only read as a whole, and, for `forwardRef`, `fn` reads no changing state (`isComponentWrapper`, `isWrapperCall`);
  - `isPlainInput(ctx, binding, start, atBlock = true)`: a local assigned only before the block, outside a closure and outside a loop that also holds the block, is an input (`isSettledLocal`). With `atBlock` false the old rule (no writes) holds.
- `packages/forgetti/src/next/plan/groups.ts`:
  - key expressions: an attribute value or child of a cacheable element that is a template, binary, unary, conditional or logical expression, reads a property, has no element or closure, and always yields a primitive, gets its own block. The element is keyed on its output. `Piece.isKey`, `findKeyExpressions`, `isPrimitiveValue`;
  - group inputs and guard tests use `isPlainInput(..., false)`.
- `packages/forgetti/test/next/plan/children/children.test.ts`: 4 tests. `refusals.test.ts`: the old "does not cache a reassigned local" test is split into a keyed-before-block test and a refusal test (write after the block, write in a closure).
- `benchmarks/corpus/tuning/stable_children/`: `Picker` (memo tag from a wrapper, inline `map` with a closure), `Totals` (a `let` a loop sums, a key expression, a `memo` tag), `Mode` (conditional `let`s).
- `nodes/fix-rc-children/probes/`: the stale-making cases (not in a corpus set, see Gotchas).

## Proof

- base: `3219c74`, `pnpm --filter compare table --set heldout --case cart_summary` and `--case dashboard_card`. Work (React, update steps): cart_summary next 54 against React Compiler 24, dashboard_card 32 against 12, stable_children 35 against 23. Causes in `log.md`.
- branch: same commands. cart_summary 19 (React Compiler 24), dashboard_card 12 (12), stable_children 16 (23). Preact: 19, 12, 16 against uncompiled 65, 54, 35.

Work per file (React and Preact next count equal here), before, after, React Compiler:

| file | before | after | React Compiler |
| --- | --- | --- | --- |
| heldout/cart_summary | 54 | 19 | 24 |
| heldout/dashboard_card | 32 | 12 | 12 |
| tuning/stable_children | 35 | 16 | 23 |
| heldout/table_sort | 77 | 68 | 158 |

No other file in `base`, `tuning` or `heldout` changed in work (46 files compared before and after). No file got worse in work. Totals (`base` + `tuning` + `heldout` + `stable_children`): React 401 (React Compiler 510, uncompiled 860), Preact 391 (uncompiled 840). Before, without `stable_children`: 449 and 439.

Files above React Compiler under amendment-1 (React, with uncompiled's count where React Compiler differs from uncompiled), after: `heldout/form_validation` (72 against 25, node `escaping-closure-bailout`). All others are at or below. On Preact no file is above uncompiled output.

Gzip (next, React): total 36280 against React Compiler 45988 (0.789). Files that grew: `base/trycatch` 292 to 330, `heldout/cart_summary` 2010 to 2174, `dashboard_card` 1942 to 2006, `hue_slider` 2292 to 2390, `list_filters` 2447 to 2622, `table_sort` 2139 to 2235, `tree_view` 1985 to 2046. `tuning/callback_globals` shrank 584 to 569. Only `heldout/tree_view` is above 1.15 times React Compiler (2046 against 1634, 1.252; it was 1.215 before this node, from the `let` rule, with no change in its work). The `let` rule costs gzip with no work gain on three files: `base/trycatch` (292 to 330), `heldout/hue_slider` (2292 to 2390) and `heldout/tree_view` (1985 to 2046, now 1.252 times React Compiler, above the 1.15 cap and worse than before this node). This is a cost of this node, left for `tree-view-size`; the key expressions add 40 to 100 bytes in `cart_summary`, `dashboard_card`, `list_filters`, `table_sort`.

## Acceptance

- `tuning/stable_children` fails the per-file rule on `3219c74` (35 > 23) and passes after (16 <= 23): pass.
- `cart_summary` and `dashboard_card` at or below React Compiler on React: pass (19 <= 24, 12 <= 12).
- 0 differences on all sets, both targets: pass (`gate` soundness PASS on React and Preact, `base`, `tuning`, `heldout`).
- No other file gets more work: pass. Two gzip rises above noted.
- Fast check: `pnpm --filter forgetti test` 22 files plus the new one, 525 tests pass; `rtk proxy pnpm lint` 0 errors; `pnpm typecheck` and `pnpm format:check` pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout` still exits 1 on its old thresholds (per-file lines against forgetti 0.8, `tree_view` gzip). By amendment-1 only `form_validation` (work) and `tree_view` (gzip) are above.

## Probes against the new rules

All ran through the harness on both targets (`probes/`, 60 steps). Final result: 0 differences, except the two noted below.

- Settled `let` rule: `LetClosure` (write in a closure that render calls), `LetAfter` (write after a read; this found a real DIFF, a frozen group read its input at the block, fixed with the strict rule for group inputs and guards), `LetCaptured` (a closure over a `let` that is written after it, called by a child during render), `LetLoop` (while loop and switch), `LetObject` (object changed after read), `LetTry` (try and catch writes), `LetGroup` and `LetGuard` (a group or guard built from a `let` that changes later), `LetBranch` (hoisted conditional), `LetAccumulate` (writes inside `map` and `for-of`), `LetEarly`.
- Wrapper rule: `Wrappers` (memo with a comparator, `forwardRef`, plain memo, with a global changed between renders of the same props).
- Key expressions: `KeyMutated` and `KeyGrow` (object or list changed in render before and after the read), `KeyHidden` (module `let` read through a function, a changing global, a ref).
- Not fixed: `KeyTouched` and `KeyTouchedPlain`: `touch(a)` changes a destructured prop in place, then `<Child v={a.x}/>`. This is a DIFF on `3219c74` too, without a key expression (`KeyTouchedPlain`). React Compiler differs as well. The `props.a` form (`KeyTouchedMember`) is sound.

## Deviations

- `benchmarks/corpus/tuning/stable_children/` is owned; no other path outside the brief changed.
- `nodes/fix-rc-children/probes/` holds probes outside the corpus sets because on mutation shapes they put next above React Compiler by design (a copy in `tuning` would fail the per-file rule).
- No IR change: key expressions use existing `output` refs.

## Stubs left

- None.

## Known gaps

- A destructured parameter passed to a call that changes it in place is not seen (`KeyTouchedPlain`, `3219c74`). Needs ownership to mark a parameter that reaches a call argument, or the planner to refuse such parameters; the latter would stop caching on `getTotal(products, state)` in `cart_summary`. Proposed for a follow-up node.
- `rows = quotes.slice(); rows.sort(...)` is opaque in ownership (`slice` is not known as fresh), so blocks that read `rows` are not cached. It does not change a count here.

## Gotchas

- A group's inputs are read where the block is, but the group was built earlier. Any relaxed input rule must keep the strict one for group inputs and guard tests.
- Key expressions are blocks of their own with the same inputs as their element on purpose (`place` does not merge an `isKey` piece into its owner).
- Scenario names must be unique inside a corpus file. `phases()` always names the first scenario `same`; with several components prefix them (`named()` in `stable_children/scenarios.js`) or the gate compares the wrong steps.

## Proposed learnings

- A cached block may read a `let` only when every write ends before the block, outside a closure and outside a loop that holds the block | the block compares the value it sees, and nothing changes it later | packages/forgetti/src/next/plan | yes (`refusals.test.ts`)
- Inputs of a group must stay strict | the group was built before the block, a changed `let` would give the group's old value a new key | packages/forgetti/src/next/plan | yes (probe `LetAfter`)

## Verification

- `pnpm build`, `pnpm typecheck`, `pnpm format:check`: pass.
- `rtk proxy pnpm lint`: 0 errors.
- `pnpm --filter forgetti test`: pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout`: soundness PASS both targets, gzip total PASS, work and per-file lines FAIL on the old rule.

## Size

- Estimated M, actual M.
