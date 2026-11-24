# Log: census

## 2026-11-23

- Branch `chore/census`, reset to `batch/compiler-rewrite` (`b6de783`).
- Read the planner (`groups.ts`, `baseline.ts`, `branches.ts`, `loops.ts`, `cost.ts`, `index.ts`) and `next/index.ts` for whole-unit bailouts.
- Instrumentation: a global sink, one record per refusal with reason, sub-reason, binding and ranges. `explain*` helpers in `baseline.ts` mirror each predicate and only run when a predicate already said no. Relax keys turn one refusal off for counterfactual runs.
- First relax run (`outer:identity`) saved 46 of 446 React lost units, 0 differences. The all-relax run saved only 60, so most lost work is not a refusal.
- Read next's output for `discussions_table` and `toaster_store`:
  - `toaster_store`: `useStore(toastOptions = {})` makes a fresh default on every call, so the block holding `mergeToasts` misses every render. Not a planner refusal.
  - `discussions_table`: the inline `columns` literal has no block of its own, `formatDate` reads `Date`, and `TableRow`/`TableCell` have `displayName` writes. Each alone saves at most 6 units.
- Wrote two source variants under `variants/` to stand for rules that do not exist: 25 units for the default literal, 56 for the discussions bundle with identity and purity relaxed.
- Instrumentation committed (`4cc0f2f`), patch written with `git diff b6de783 4cc0f2f`, reverted (`8af5311`). Dumped next output for 124 files with and without the patch: no difference.
- Raw data moved from JSON to JSON Lines: `oxfmt --check` formats `.json` files, and the relax files now keep next rows only.
