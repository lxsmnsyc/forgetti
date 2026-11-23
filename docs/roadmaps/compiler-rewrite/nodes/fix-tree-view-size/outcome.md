# Outcome: fix-tree-view-size

## Built

- `packages/forgetti/src/next/plan/cost.ts`: `runPrune`, a planner pass that runs after `loops`. It removes a value block when its output is a host-only tree: the block has at least 4 inputs (`MIN_INPUTS`), the tree holds no component element and no call outside closures and outside the outputs of other blocks and child caches, and the element only reaches the component's `return` through host elements, fragments, conditionals and attributes (`isHostReturn`). A block that a kept block lists as an input stays. A branch cache left with no block and no child is removed, and the slots are packed again.
- `packages/forgetti/src/next/plan/index.ts`: one entry, `prune`, in the pass list.
- `packages/forgetti/test/next/emit/prune.test.ts`: 5 tests (dropped wrapper, kept with a component, kept with a call, kept as a prop of a component, kept in a variable).

## Proof

- base: `3a75879`, `pnpm --filter compare table --set heldout --case tree_view`: 2046 gzip against React Compiler 1634 (1.252), 72 slots.
- branch: same command: 1806 gzip (1.105), 46 slots. Work steps identical on React and Preact (same as React Compiler).

Totals (`base`, `tuning`, `heldout`): work React 374 and Preact 355, unchanged; no file changed in work (totals are equal and the pass only removes caches, so none can fall). Gzip total 37216 against React Compiler 47458 (0.784), down from 38027 (0.801). The gate reports no file above 1.15 times React Compiler.

## Deviations

- `plan/index.ts` gets one line (wiring file, allowed by `GOAL.md`).
- `test/next/api.test.ts` lists the pass names; its expected list gained `prune`.
- The pass sits in `plan/cost.ts`, the owned path, and not in a new file.

## Stubs left

- None.

## Gotchas

- A cached host tree can hold calls (`formatPrice(x)`). Dropping its block repeats the call every render, so calls count as work. A first version without that check raised `dashboard_card` work from 12 to 42.
- `MIN_INPUTS` is 4 because 20 existing tests assert the cached form of small elements such as `<h1>{title}</h1>`. Small blocks cost little gzip.
- The groups pass lists the raw inputs of a conditional that the branches pass moves out. The pruned `div` block had 12 of them.

## Proposed learnings

- A block that caches only host elements, with no call and no component, saves no render or call | React reconciles host nodes for free | packages/forgetti/src/next/plan | yes (`prune.test.ts`)
- A host element that a component receives, or that is stored in a variable, keeps its block | its identity decides whether the component re-renders | packages/forgetti/src/next/plan | yes (`prune.test.ts`)

## Verification

- `pnpm --filter forgetti test`: 24 files plus the new one pass.
- `pnpm lint` (`rtk proxy`): 0 errors. `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout`: soundness PASS on React and Preact (0 differences), gzip total PASS, per-file gzip PASS, compiled share PASS. Work and per-file work lines FAIL only on the old rule against forgetti 0.8, with the same values as before this node.

## Size

- Estimated S, actual M. The cost rule needed the call check and an input threshold.
