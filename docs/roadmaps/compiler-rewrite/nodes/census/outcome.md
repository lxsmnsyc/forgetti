# Outcome: census

## Built

- `benchmarks/compare/results/census/census.md`: the report. Ranking, join, rule sketches, confidence.
- `benchmarks/compare/results/census/instrument.patch`: the planner instrumentation (`git diff b6de783 4cc0f2f`), committed in `4cc0f2f` and reverted in `8af5311`. No `packages/` change lands.
- `run.ts` (data collection, needs the patch), `analyze.py` (tables), raw data as JSON Lines, tables as TSV, and two source variants in `variants/`.

## Proof

Not a fix node.

## Result

Not an experiment node. Findings, on the development sets only (`base`, `tuning`, `heldout`, `heldout2`):

- Lost steps (next equal to uncompiled, above 0): React 174 steps, 446 units. Preact 171 steps, 435 units. React Compiler does the same work on 358 of the 446 React units. Excess of next over React Compiler, per step: 87 units on 25 steps in 6 files.
- Refusals explain little. Turning off every refusal that can be turned off saves 60 of 446 units and 18 of 87 excess units. The largest causes are values that are cached but get a new identity each render.
- Ranking, measured by full harness runs with one change each (React units; Preact is the same):

| Family | Lost units | Share of 446 | Excess units (of 87) | Files |
| --- | --- | --- | --- | --- |
| A. identity: member writes (`displayName`) on `memo`/`forwardRef` wrappers | 46 | 10.3% | 9 | form_check, toast_stack |
| D. fresh default parameter (`x = {}`) | 25 | 5.6% | 25 | toaster_store |
| C. `new Date(arg)` reads no clock | 6 | 1.3% | 6 | discussions_table |
| P18. shared call results | 6 | 1.3% | 1 | base/hook, pricing_plans |
| B. nested fresh literal gets its own block | 0 alone | 0% | 0 | none alone |
| **A+B+C bundle** | **102** | **22.9%** | **51** | discussions_table (56), form_check (27), toast_stack (19) |

- 15% entry rule (67 React units): no single rule passes. A alone is 10.3%. B and C save almost nothing without A; `discussions_table` needs all three. As one family, A+B+C passes at 22.9%. D fails at 5.6%, although it is 28.7% of the excess over React Compiler.
- Predicted shares for the top two families (a family node must close at least half):
  1. A+B+C, "component identity": 102 React units (22.9%), 102 Preact units (23.4% of 435), 51 excess units. Half: 51 React units.
  2. D, "fresh default parameter": 25 React units (5.6%), 25 Preact units, 25 excess units. Half: 13. Fails the entry rule.
- `heldout2/discussions_table`: covered only by A+B+C (64 to 8, React Compiler 22). Each part alone saves at most 6.
- `heldout2/toaster_store`: covered by D, 25 of its 29 excess units (74 to 49, React Compiler 45). The other 4 (`pause/pause`) are covered by no measured family. A likely rule is member inputs on non-props objects (`state.toasts`), not measured. "Method calls on hook results" (O11, O17) is not the cause.
- Rule sketches:
  - A: a module binding from `memo(...)`/`forwardRef(...)` of `react`/`preact` stays identity-stable when every member write on it is an unconditional top-level statement. `forwardRef` bodies still must read no changing state.
  - B: an object, array or function literal nested in an element's attribute or child, or in a cached call's argument, gets its own block on its own inputs; the element compares the literal's output.
  - C: `Date` used as `new Date(x)` with an argument is stable. `Date.now()` stays refused.
  - D: a fresh literal default (`x = {}`) gets a block keyed on the parameter, so it keeps one identity while the parameter is `undefined`.
- Gate outlook, dev sets: with A+B+C and D, `heldout2` React goes from 259 to 132 (React Compiler 186). Still above React Compiler per file: `toaster_store` 49 against 45 and `tuning/callback_globals` 8 against 3 (no sound family: global reads in closures and props passed to a call).
- reproduce: commit `8af5311` plus `git apply benchmarks/compare/results/census/instrument.patch`, then the commands in `census.md` "Reproduce". Node 26.12.1, macOS, 8 cores, 8 GB RAM.

## Deviations

- The brief asks to rank families by refusals joined to steps. The refusal join explains under a fifth of the lost units, so the ranking is by counterfactual runs (one refusal relaxed, or one source variant), and the refusal join is kept as `join.tsv` with a text matcher, marked as a guess.
- Two of the four ranked rules (B, D) have no refusal site in the planner today. They were found by reading next's output for the two largest files and measured with source variants in `results/census/variants/`.
- `findAssignedCall` and statement shapes other than `const` and `return` are not instrumented. No excess step points at them.
- The instrumentation commit and its revert are on the branch, as the task asked, so the branch has three commits.

## Stubs left

- None.

## Gotchas

- A relax run may be unsound. Only units on steps whose output still equals uncompiled output are counted, and differences are listed per run in `relax.tsv`.
- The A+B+C bundle interacts: a node that builds only B or only C saves at most 6 units on `discussions_table`. A alone saves 46 elsewhere.
- `oxfmt --check` formats `.json` files. Raw data is JSON Lines for that reason.
- `run.ts` must run with `benchmarks/compare` as the working directory, like `regate/save.ts`.
- The gate's React stderr is very long; the relax runs were started with `2>/dev/null`.

## Proposed learnings

- Rank planner work by counterfactual harness runs, not by refusal sites | 362 refusal sites in T1 pointed at destructuring and hook results, which cost no measured step, while the two largest gaps had no refusal site at all | benchmarks/compare | no

## Verification

- Output unchanged: `run.ts dump` on all 62 dev cases, React and Preact (124 files), at `8af5311` and with the patch applied; `diff -r` empty.
- `pnpm --filter forgetti test` (alone, with the patch applied): 25 files, 546 tests pass.
- `pnpm --filter forgetti test` (alone, final tree): 25 files, 546 tests pass.
- `pnpm --filter compare test`: 30 passed, 6 skipped (held-out tests need `--set`).
- `pnpm --filter compare typecheck`: pass.
- `pnpm format:check`: pass.

## Size

- Estimated M, actual M.

## Orchestrator notes (from the fresh review)

- "No sound family" for `tuning/callback_globals` holds for GlobalMemo and GlobalPlain (2 units) only. PropsFill (3 units) and `toaster_store` `pause/pause` (4 units) may be closed by a narrower rule never measured: key on `props.a` past a call that receives only props members. 7 of the 87 units over React Compiler.
- Sound totals for "turn off every refusal" are 58 of 446 and 16 of 87 (the per-step filter let 2 units of the unsound all-globals relaxation through). The ranking is unchanged.
- Rule D needs a read-only check on the parameter, or a default that is changed leaks between renders.
- "62 files / 124 files" for the output dump means 57 cases / 114 files.
