# Log: fix-rc-children

## Proof on the current batch

Commit `3219c74` (`batch/compiler-rewrite`), `pnpm build`, then `pnpm --filter compare table --set heldout --case <name>`.

- `cart_summary`: next 54 against React Compiler 24. r3 on `same`, `new_products`, `one_price`, `one_discount`, `new_checkout` and every `shopping` step: the three `MemoProductItem` render again. Reproduced.
- `dashboard_card`: next 32 against 12. r1 on every step (the `Child`), c1 on most steps (`formatMoney(total, currency)`), c5 on `expand`. Reproduced.
- `tuning/stable_children` (written after the causes were known): next 35 against React Compiler 23 on `3219c74`. Fails the per-file rule.

## Causes, step by step

1. `cart_summary`, `Shop` return: the root `<div>` is not cached. A debug print of `collectDeps` failed on `MemoProductItem`. It is `const MemoProductItem = memo(...)` at module level. `isStableOuter` accepts functions, classes, imports and literal initializers only, so a call initializer made every element that holds the tag uncacheable, and with it the tree and the inline `products.map(...)` inside it. Cause 1: a module `const` made by an imported `memo` or `forwardRef` call.
2. `dashboard_card`, `formatMoney(total, currency)` and `Child v={best ...}`: `total` and `best` are `let` bindings that a loop assigns. `isPlainInput` refuses any binding with a write reference, so every block that reads them is dropped. Cause 2: a `let` assigned before the block was treated like one that can change under it.
3. After 1 and 2, `dashboard_card` was r1 where React Compiler is r0 on steps with fresh `quotes` objects. `Child v={best ? ... : ...}` was keyed on `best` (a new object each time). React Compiler keys on the string. Cause 3: an element keyed on an object when the prop it reads is a primitive built from a property read.
4. The `hex_input` shape (`...rest` keyed block) is not a cause of either row. Neither file destructures rest.
5. Not fixed, seen in `dashboard_card`: `rows` (`quotes.slice(...)` then `rows.sort(...)`) is opaque in ownership, so blocks that read it stay uncached. It does not change the counts of this file, so it is left for a node that owns ownership.

## Fix

- `baseline.ts`: `isComponentWrapper` and `isWrapperCall` (cause 1), `isSettledLocal` and `isPlainInput(..., atBlock)` (cause 2).
- `groups.ts`: key expression pieces (`isKey`, `findKeyExpressions`, `isPrimitiveValue`) (cause 3).

## Soundness findings during the work

- The first version of cause 2 relaxed `isPlainInput` everywhere. Probe `LetAfter` (`let label = a; const first = <Child v={label}/>; label = b; return <div>{first}...`) gave a DIFF on both targets: a frozen group stood for its inputs read at the block, not at the group's creation. Fixed: group inputs and guard tests keep the strict rule (`atBlock` false).
- `memo(fn, () => false)` and `forwardRef(fn)` can render on equal props, which an unchanged element does not. `memo` with one argument is the same as an unchanged element. Probe `Wrappers` covers it. A comparator, a non-import `memo`, and a `forwardRef` whose function reads a changing global are refused.
- Found on the base batch, not caused by this node: `function touch(o) { o.x = (o.x || 0) + 1 }` then `export function C({ a }) { touch(a); return <Child v={a.x} /> }` gives a DIFF on next at `3219c74` (React Compiler too). A destructured parameter passed to a call may be changed in place. The `props.a` form is already refused. Left as a gap, see `outcome.md`.

## Probes

`probes/` holds the stale-making cases. They are not in the corpus sets: on mutation shapes next does more work than React Compiler by design. To run them, copy the folder to `benchmarks/corpus/tuning/stable_children_probes/` and run `pnpm --filter compare table --set tuning --case stable_children_probes`. Result on the final code: 0 differences except `KeyTouched` and `KeyTouchedPlain` (the base-batch gap).
