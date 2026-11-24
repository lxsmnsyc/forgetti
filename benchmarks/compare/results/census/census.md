# Census: planner refusals weighted by lost steps

Development sets only: `base`, `tuning`, `heldout`, `heldout2` (62 files). `heldout3` was not opened or compiled. Compiler: next at `b6de783` with `instrument.patch` applied. React Compiler runs under Babel 7, as in `results/rc-babel7/`.

## Summary

- A lost step is an update step where next's work equals the uncompiled work and that work is above 0. React: 174 lost steps, 446 units. Preact: 171 steps, 435 units.
- React Compiler does the same uncompiled work on 358 of the 446 React units. The excess of next over React Compiler, summed per step where next is higher, is 87 units on 25 steps, in 6 files.
- Turning off every refusal that can be turned off (identity, purity, call results, globals, props) saves only 60 of the 446 units and 18 of the 87 excess units. Most lost work is not caused by a refusal. It comes from values that are cached but get a new identity on every render, which no refusal site records.
- Measured by turning refusals off one family at a time, and by two source variants, the families rank as follows (React units, Preact is the same):

| Family                                                     | Lost units saved | Share of 446 | Lost steps saved | Excess units saved (of 87) | Files                                      | Measured how                           |
| ---------------------------------------------------------- | ---------------- | ------------ | ---------------- | -------------------------- | ------------------------------------------ | -------------------------------------- |
| A. identity: member writes on `memo`/`forwardRef` wrappers | 46               | 10.3%        | 19 of 174        | 9                          | form_check 27, toast_stack 19              | relax `outer:identity` (0 differences) |
| D. fresh default parameter (`x = {}`)                      | 25               | 5.6%         | 7                | 25                         | toaster_store 25                           | source variant                         |
| C. purity: `new Date(arg)` reads no clock                  | 6                | 1.3%         | 1                | 6                          | discussions_table 6                        | relax `global:Date` (0 differences)    |
| P18. shared call results                                   | 6                | 1.3%         | 5                | 1                          | base/hook 4, pricing_plans 2               | relax `result:call` (0 differences)    |
| B. nested fresh literal gets its own block                 | 0 alone          | 0%           | 0                | 0                          | none alone                                 | source variant                         |
| A+B+C together, on discussions_table                       | 56               | 12.6%        | 10               | 42                         | discussions_table                          | source variant plus relax              |
| **A+B+C bundle, all files**                                | **102**          | **22.9%**    | **29 (16.7%)**   | **51 (58.6%)**             | discussions_table, form_check, toast_stack | sum of the two rows above              |

- 15% entry rule (debate-2 P18), on React lost units (67 units needed):
  - No single rule reaches 15%. Identity (A) is the largest alone at 10.3%.
  - B and C save almost nothing alone. On `discussions_table` they save 56 units only together with A. As one family, A+B+C is 102 units, 22.9%. It passes if the orchestrator accepts the bundle as one family.
  - D is 5.6% and fails the rule as written. It is 25 of the 87 units above React Compiler (28.7%).
- Predicted shares for the top two families, the figure a family node is held to (it must close at least half):
  1. A+B+C, "component identity": 102 React units (22.9% of 446), 102 Preact units (23.4% of 435), 51 excess units. Half: 51 React units.
  2. D, "fresh default parameter": 25 React units (5.6%), 25 Preact units, 25 excess units. Half: 13 units. Fails the 15% entry rule.
- `heldout2/discussions_table`: covered by A+B+C only. Each part alone saves at most 6 of its 42 excess units. Together they bring it from 64 to 8 (React Compiler 22).
- `heldout2/toaster_store`: covered by D, 25 of its 29 excess units (74 to 49, React Compiler 45). The other 4 units (`pause/pause`) are covered by no measured family. The debate's "method calls on hook results" (O11, O17) is not the cause: no refusal on the hook result costs a step.

## Method

1. **Instrumentation** (`instrument.patch`). A sink `globalThis.__forgettiCensus` collects one record per refusal: file, unit, site, reason code, sub-reason, failing binding, the range of the failing use and the range of the refused expression. With the sink unset, the compiler runs the same code paths and gives byte-identical output (checked below). Sites:
   - `groups.ts`: `findPropsId` (props handed to a call), `findCandidate` (several declarators, destructuring, result changed by a group, call result not read-only, with the first failing use), `planCandidate` (cheap expression, value with no inputs), `createPiece` (impure syntax with the node, changing global, hidden member in a closure, and one record for every binding with no usable input), `isFrozenGroup` (why the group is not frozen).
   - `baseline.ts`: `explainOuter` says why `isStableOuter` rejects a binding and splits it into `identity:*` (wrapper member write or read, call initializer, object initializer, not module scope), `purity:*` (a held function reads a changing global, `ref.current` or a written binding, followed through same-module calls) and `written:*`. `explainLocal`, `explainUse`, `explainResultUse` and `explainImpureSyntax` do the same for `isPlainInput`, `isReadOnlyUse`, `isResultReadOnly` and `isPureSyntax`.
   - `branches.ts`: a nested conditional that cannot be hoisted, with the failing binding.
   - `loops.ts`: `.map` sites refused for an optional chain, parameters or a receiver that cannot be hoisted; a `.map` whose call shares a block; a loop or `.map` body with no block.
   - `cost.ts`: blocks removed by the prune pass.
   - `index.ts`: whole-unit skips, eligibility failures and ownership bailouts; every block the final plan keeps.
   - Relax keys: with the sink set, a listed key turns one refusal off (`outer:identity`, `outer:purity`, `global:<name>`, `result:call`, `props`). A relaxed run may be unsound. Differences against uncompiled output are counted for every run.
2. **Steps** (`steps-baseline.jsonl`): one harness run of plain, next and React Compiler on both targets. A React Compiler step whose output differs from uncompiled output is charged the uncompiled count (amendment-1).
3. **Counterfactuals**: each relax run (`relax-*.jsonl`) and each variant run (`variant-*.jsonl`) is compared step by step with the baseline. A unit counts as saved only on a lost step whose output still equals uncompiled output.
4. **Variants** (`variants/`): copies of two `heldout2` files with one source change each, standing for a planner rule that does not exist yet:
   - `toaster_default`: `toastOptions = {}` becomes `toastOptions = NO_OPTIONS` with a module `const NO_OPTIONS = {}`.
   - `discussions_columns`: the inline `columns={[...]}` literal becomes a `const columns = [...]` statement, so it gets its own block.
5. **Static join** (`join.tsv`): for every counter key of a lost step, the functions that count it, every element `<Name` or call `name(` that runs them, whether a block holds the site, and the innermost refusals whose range holds it. This is a text join and a guess. The counterfactual runs are the exact join.

Totals check: next React work in `steps-baseline.jsonl` equals `results/rc-babel7/checks.txt` (633 all sets, 259 on `heldout2`; React Compiler adjusted 723 and 186).

## Lost steps per file

React. `rc` is React Compiler's work on the same steps. Preact lost units are in `per-file.tsv`.

| File                       | Lost steps | Lost units | rc on them | Excess over rc                 |
| -------------------------- | ---------- | ---------- | ---------- | ------------------------------ |
| heldout2/toaster_store     | 16         | 74         | 45         | 29                             |
| heldout2/discussions_table | 11         | 64         | 22         | 42                             |
| heldout2/form_check        | 12         | 41         | 38         | 3                              |
| heldout/tree_view          | 4          | 39         | 39         | 0                              |
| heldout2/toast_stack       | 12         | 27         | 21         | 6                              |
| heldout/form_validation    | 2          | 16         | 16         | 0                              |
| heldout/list_filters       | 7          | 13         | 13         | 0                              |
| heldout2/pagination        | 7          | 13         | 13         | 0                              |
| tuning/stable_children     | 6          | 13         | 13         | 0                              |
| tuning/loop_shapes         | 5          | 12         | 12         | 0                              |
| tuning/throw_row           | 1          | 12         | 12         | 0                              |
| base/forloop               | 4          | 11         | 11         | 0                              |
| heldout2/pricing_plans     | 3          | 11         | 11         | 2 (on a step that is not lost) |
| tuning/escaping_closure    | 4          | 10         | 10         | 0                              |
| tuning/callback_globals    | 8          | 8          | 3          | 5                              |
| 28 other files             | 72         | 82         | 82         | 0                              |
| **Total**                  | **174**    | **446**    | **361**    | **87**                         |

## Join: excess over React Compiler, step by step

Each row names the counted work, the value that would have to be cached to skip it, the refusal or gap that stops it, and how sure the join is.

| File, steps                                                                                                       | Work next does                             | What must be cached                                                                                                                                                                  | Blocked by                                                                                                                                                                                                                                               | Join                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| discussions_table, `same` (6 units)                                                                               | `Row` 3 (DeleteDiscussion), `formatDate` 3 | the `<Table>` element in `DiscussionsList`                                                                                                                                           | `outer_binding_unstable`, `purity:fn_reads_global:Date`: the inline `columns` reads `formatDate`, which calls `new Date(value)`                                                                                                                          | exact: relax `global:Date` saves these 6                                                                                |
| discussions_table, `first_page`, `last_page`, `no_meta`, `page_3`, `page_3_again`, `page_4` (36 units)            | `Row` 3, `formatDate` 3 on each            | the `columns` array on its own block, so a miss of `<Table>` (its `pagination` input changes) keeps the `Cell` component types; then each `<TableRow>` and `<TableCell>` row element | three gaps together: no block for a fresh literal nested in an element (no refusal record, B); `formatDate` purity (C); `TableRow`, `TableCell` are `forwardRef` with a `displayName` write (`identity:wrapper_member_write`, A), so `map_body_no_block` | exact: the variant with A and C relaxed saves 56 lost units and all 42 excess units; any one part alone saves at most 6 |
| toaster_store, `same`, `same_seed`, `gutter`, `reverse`, `class_name`, `pause/same` (24 units), `bottom` (1 unit) | `merge` 1, `Child` 3 (memo `ToastBar`)     | the default `toastOptions = {}` of `useStore`, so the `{ ...state, toasts: mergeToasts(...) }` block keeps its value                                                                 | not a refusal: the default literal is a fresh object on every call, and the block that holds `mergeToasts` keys on it                                                                                                                                    | exact: the `toaster_default` variant saves 25 units, 0 differences                                                      |
| toaster_store, `pause/pause` (4 units)                                                                            | `merge` 1, `Child` 3                       | `mergeToasts(state.toasts, toastOptions)` keyed on `state.toasts`, not `state` (`START_PAUSE` changes `pausedAt` only)                                                               | not a refusal: only `props` gets member inputs, and the nested call has no block of its own                                                                                                                                                              | guess, not measured                                                                                                     |
| form_check, `same` (3 units)                                                                                      | `Child` 3                                  | the `FormCheckLabel` and `Feedback` elements                                                                                                                                         | `identity:wrapper_member_write:displayName` (both are `forwardRef` with a `displayName` write)                                                                                                                                                           | exact: relax identity saves them                                                                                        |
| toast_stack, `same`, `same_initial`, `timer/same_timer` (6 units)                                                 | `Child` 2 on each                          | the `ToastBody` element                                                                                                                                                              | `identity:wrapper_member_write:displayName`                                                                                                                                                                                                              | exact: relax identity saves them                                                                                        |
| callback_globals, `GlobalMemo/again_clear`, `GlobalPlain/again_clear` (2 units)                                   | `CallMemo` 1, `Call` 1                     | elements whose closures read `globalThis`                                                                                                                                            | `unstable_global_read`, correct by design: relaxing every global saves them but adds 6 wrong steps                                                                                                                                                       | exact, but no sound rule                                                                                                |
| callback_globals, `PropsFill_*` (3 units)                                                                         | `Child` 1 on each                          | the element keyed on `props` members                                                                                                                                                 | `props_not_readonly` (props reach a call); relaxing it saves nothing and adds 3 wrong steps                                                                                                                                                              | exact for the refusal, no sound rule measured                                                                           |
| pricing_plans, `same` (2 units, not a lost step)                                                                  | `Btn` 2                                    | the `<Button>` elements                                                                                                                                                              | `Button` is a `forwardRef` whose body reads `ref.current` through `mergeRefs` (`purity:forwardRef_reads_via:mergeRefs`); relax `outer:purity` does not save it, the all-relax run saves 1                                                                | guess                                                                                                                   |

## Where the other lost units go

- 358 of the 446 React units are on steps where React Compiler also does the uncompiled work: an input of the counted child or call changes in the scenario. Identity (A) saves 46 units, of which only 9 are above React Compiler: the other 37, in `form_check` and `toast_stack`, would take next below React Compiler there.
- `tree_view` (39), `form_validation` (16), `list_filters` (13), `pagination` (13), `stable_children` (13), `loop_shapes` (12), `throw_row` (12), `forloop` (11), `escaping_closure` (10): React Compiler equals next on every lost step. No relax run moved them.
- `base/hook` (4 of 6 units): saved by `result:call` relaxed (the hook result is handed to a call, P18), 0 differences. React Compiler does the same work.

## Refusal sites, identity split from purity

React compiles, de-duplicated (the groups and branches passes both call `findCandidate`). Full list: `refusals-by-family.tsv`, raw records: `refusals.jsonl`. Sites are not lost steps. Only the families above cost measured steps.

| Family of the refusal                                                                                                                              | Sites | Lost units it costs (measured)                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| cheap expression (no slot by design)                                                                                                               | 86    | not measured, cheap by definition                                    |
| destructuring                                                                                                                                      | 61    | no measured step: no excess step is left that destructuring explains |
| identity: wrapper member write or read (`displayName`)                                                                                             | 55    | 46 alone, 102 with B and C                                           |
| call result is a hook call                                                                                                                         | 41    | none: no compiler caches a hook call                                 |
| impure syntax: hook call inside the expression                                                                                                     | 36    | none                                                                 |
| call result changed by a group (`unsafe`)                                                                                                          | 29    | not relaxable soundly                                                |
| call result handed on, or a method called on it (P18)                                                                                              | 30    | 6 (`result:call`)                                                    |
| identity: call initializer (`createButton`, `createContext`)                                                                                       | 18    | 0 (`relax-identity-member` equals `relax-identity`)                  |
| identity: other (not module scope, object initializer)                                                                                             | 5     | 0 (same runs)                                                        |
| purity: reads `ref.current`                                                                                                                        | 13    | 0 alone                                                              |
| purity: reads a changing global                                                                                                                    | 9     | 6 (`Date`)                                                           |
| unstable global read in an element                                                                                                                 | 8     | 2, unsound                                                           |
| props handed to a call                                                                                                                             | 7     | 0, unsound                                                           |
| `.map` or loop body with no block                                                                                                                  | 13    | part of A                                                            |
| other (prune pass 15, group not frozen 14, nested conditional not hoisted 12, unit bailouts 5, local changed 5, hidden state 4, `.map` receiver 2) | 57    | not measured                                                         |

## Family rules, sketched

- **A. Identity (P17).** A module binding initialized by `memo(...)` or `forwardRef(...)` from `react` or `preact` stays identity-stable when every member write on it (`X.displayName = ...`, `X.Item = ...`) is an unconditional top-level statement of the module and no other code writes its members. `forwardRef` still needs a body that reads no changing state. Reads of `X.Item` as a tag read a member written once at load. Mutation operators: the write moved into a conditional, a function body or a handler (O10).
- **B. Nested fresh literal.** An object, array or function literal in an attribute or child position of an element, or in an argument of a cached call, gets its own block keyed on its own inputs. The element compares the literal's output instead of its inputs, so a miss of the element (another prop changed) keeps the literal's identity. This keeps `Cell` methods of `columns` from becoming new component types. Mutation operators: a literal whose method reads a changing global or `ref.current`.
- **C. Purity precision (O16).** `Date` read as a constructor with an argument (`new Date(x)`) is stable: only `Date.now()` and `new Date()` with no argument read the clock. `Date.now` is already refused by the hidden-member check.
- **D. Fresh default parameter.** A default value that is a fresh literal (`x = {}`, `x = []`) gets a block keyed on the parameter, as `x === undefined ? (slot ?? {}) : x`, so the default keeps one identity while the parameter is `undefined`. Only 2 such defaults exist in the dev sets (`toaster_store`, `pricing_plans` `style = {}`).
- **Not a family:** "method calls on hook results" (O11, O17), destructuring and hook-call results. No measured step depends on them.

## Confidence

- Exact: every number in the ranking table and the join rows marked exact. Each comes from a full harness run with one change, compared step by step, with output checked against uncompiled output.
- Upper bound: a relax run turns a whole refusal family off. A real rule is narrower, so a family node can save less. Identity (A) is close to exact: `relax-identity-member`, which allows only member writes and reads on `memo`/`forwardRef` wrappers, saves the same 46 units, and every such write in the dev sets is an unconditional top-level `displayName` statement, which the P17 rule allows.
- Interaction: B, C and A interact on `discussions_table`. The 56 units need all three. A node that builds only part of the bundle saves at most 6 there.
- Guess: `join.tsv` (text matching of counter keys to elements and calls), the `toaster_store` `pause/pause` row and the `pricing_plans` row.
- Variants stand for rules that do not exist yet. A rule that caches less than the variant does saves less.

## Files

- `instrument.patch`: the instrumentation, `git diff b6de783 4cc0f2f`. Committed in `4cc0f2f` and reverted in `8af5311`, so no `packages/` change lands.
- `run.ts`: collects the data (`refusals`, `steps`, `relax`, `variant`, `dump` modes). Needs the patch applied.
- `analyze.py`: computes the lost steps, the excess, the static join and the relax table. Needs Python 3 only.
- Raw data, JSON Lines: `refusals.jsonl`, `steps-baseline.jsonl`, `relax-*.jsonl` (next rows only) with `relax-*.keys`, `variant-*.jsonl` with `variant-*.keys`.
- Tables: `lost-steps.tsv`, `excess-steps.tsv`, `per-file.tsv`, `join.tsv`, `relax.tsv`, `refusals-by-family.tsv`.
- `variants/`: the two changed case folders.

## Reproduce

From the repo root, with the patch applied (`git apply benchmarks/compare/results/census/instrument.patch`):

```sh
pnpm --filter compare exec node results/census/run.ts refusals results/census/refusals.jsonl base tuning heldout heldout2
pnpm --filter compare exec node results/census/run.ts steps results/census/steps-baseline.jsonl base tuning heldout heldout2
pnpm --filter compare exec node results/census/run.ts relax results/census/relax-identity.jsonl outer:identity base tuning heldout heldout2
pnpm --filter compare exec node results/census/run.ts variant results/census/variant-plain.jsonl - results/census/variants/toaster_default results/census/variants/discussions_columns
python3 benchmarks/compare/results/census/analyze.py
```

The other relax and variant runs use the keys in their `.keys` files. Node 26.12.1, macOS, 8 cores, 8 GB RAM.

## Output unchanged

`run.ts dump` wrote next's output for all 62 cases on React and Preact (124 files) twice: at `8af5311` (patch reverted) and with the patch applied. `diff -r` found no difference.
