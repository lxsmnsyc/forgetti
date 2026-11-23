# regate: hypothesis gate under amendment 1

Verdict: **missed**. No kill criterion fired.

- Missed thresholds:
  - React, no file above React Compiler: 5 files above (1 in `tuning`, 4 in `heldout2`).
  - React, total work below React Compiler on `heldout2` alone: next 259 against 186.
- Every other threshold passes, overall and on `heldout2` alone.
- Commit measured: `9cf2749` (`batch/compiler-rewrite` at `3012731` plus the amendment-1 `gate.ts`). No compiler code changed.
- Corpus: 62 files. `base` 15, `tuning` 29, `heldout` 10, `heldout2` 8.
- Targets: React 19.3.1 and Preact 11.2.0. React Compiler 1.0.0 runs on React only.
- Command: `pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2` (exit 1).
- Outputs: `regate/checks.txt` (gate lines) and `regate/table.txt` (harness tables: sizes, slots, compile ms, every scenario step), both written by `regate/save.ts` from one `collect`. `regate/per-file.md` is the table below, made from `checks.txt` by `regate/per-file.ts`.
- Repeat runs: three full runs (two through `save.ts`, one through the CLI command) gave identical gate output (`regate/run2/checks.txt`). The step counts in `table.txt` were identical too. Only the compile ms column changed.
- Check run before `heldout2` was read: `regate/pre-heldout2/` (`base`, `tuning`, `heldout`). Its only miss is `tuning/callback_globals`.
- Machine: 8 cores, 8 GB RAM, Node 26.12.1, macOS.

## Exposure

`heldout` was measured in full by `final-gate`, and the fix nodes after it looked at its components (`debate/amendment-1.md`, "Exposure"). `fix-tree-view-size` chose its prune threshold (`MIN_INPUTS = 4`) while measuring `heldout/tree_view`. Its rows still count, but `heldout2` is the clean check. No `next` or forgetti 0.8 output for `heldout2` was produced before `gate.ts` was committed.

## Thresholds

Thresholds as fixed in `docs/roadmaps/compiler-rewrite/debate/amendment-1.md`. Work is child re-renders plus `costly()` recomputes over the update steps (`sumWork` in `src/metrics.ts`). React Compiler's work is adjusted: on a step where its output differs from uncompiled output, the uncompiled count is used.

| Threshold                                                | All sets                              | Result   | `heldout2` alone                    | Result   |
| -------------------------------------------------------- | ------------------------------------- | -------- | ----------------------------------- | -------- |
| 0 differences, React                                     | 0                                     | pass     | 0                                   | pass     |
| 0 differences, Preact                                    | 0                                     | pass     | 0                                   | pass     |
| React total work strictly below React Compiler           | next 633, RC 723                      | pass     | next 259, RC 186                    | **miss** |
| React, no file above React Compiler                      | 5 files above                         | **miss** | 4 files above                       | **miss** |
| Preact total work strictly below uncompiled              | next 611, plain 1128                  | pass     | next 256, plain 267                 | pass     |
| Preact, no file above uncompiled                         | 0 files above                         | pass     | 0 files above                       | pass     |
| Total gzip at most 1.0 times React Compiler              | 57875 against 71947, 0.804            | pass     | 20659 against 24489, 0.844          | pass     |
| No file above 1.15 times React Compiler gzip             | worst `heldout/tree_view` 1.105       | pass     | worst `pricing_plans` 1.025         | pass     |
| Compiled share at least React Compiler's, held-out files | 97/101 (0.960) against 68/132 (0.515) | pass     | 67/70 (0.957) against 49/94 (0.521) | pass     |

"All sets" is `base`, `tuning`, `heldout` and `heldout2`. The compiled share on "all sets" counts `heldout` and `heldout2`. Without `heldout2`, the totals are React 374 against 537, Preact 355 against 861, gzip 0.784, share 30/31 against 19/38 (`regate/pre-heldout2/checks.txt`).

### Files above React Compiler (React)

| File                         | next | RC adjusted | plain | Steps where RC is lower                                                                                                                                                  |
| ---------------------------- | ---- | ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tuning/callback_globals`    | 8    | 3 (raw 1)   | 8     | `GlobalMemo/again_clear` and `GlobalPlain/again_clear` (c1 against c0), `PropsFill_same/same`, `PropsFill_same/same_again`, `PropsFill_one_a/same_again` (r1 against r0) |
| `heldout2/discussions_table` | 64   | 22          | 64    | 7 of 13 steps (r3 c3 against r0 c0), `same` included                                                                                                                     |
| `heldout2/form_check`        | 41   | 38          | 41    | `same/same` (r3 against r0)                                                                                                                                              |
| `heldout2/toast_stack`       | 27   | 21          | 27    | `same`, `same_initial`, `timer/same_timer` (r2 against r0)                                                                                                               |
| `heldout2/toaster_store`     | 74   | 45          | 74    | 7 of 16 steps (`same`, `same_seed`, `gutter`, `reverse`, `class_name`, `pause/pause`, `pause/same`: r3 c1 against r0 c0), and `bottom` (c1 against c0)                   |

On `heldout2`, next does exactly the uncompiled work on every step of 7 of 8 files. Only `pricing_plans` is lower (React 31 against 48, Preact 28 against 39). The four files above lose on steps where the parent renders again with equal inputs. React Compiler skips the children there and next renders them again. What the compiled output shows for each file (read after the gate ran):

- `toast_stack`: the toast list (`visible.map(...)`) is not cached. Each `Toast` element has `onClose: () => globalThis.__toasts.dismiss(toast.id)`, a closure that reads a global that is not stable, which the planner refuses wherever it appears (rule from `fix-rc-callbacks`). The closure only runs on an event.
- `form_check`: the `options.map(...)` list is not cached. Its callback calls `selected.includes(...)` and `disabledKeys.includes(...)`, and builds `onChange: () => globalThis.__checks.toggle(option.id)`.
- `toaster_store`: the `toasts.map(...)` list is not cached as a whole. Its callback calls `handlers.calculateOffset(...)` on a hook result. Only the `getPositionStyle` call inside each item is cached.
- `discussions_table`: `DiscussionsList` passes `columns`, an array of objects with `Cell` methods that capture `onDiscussionPrefetch`. It is rebuilt every render, so `Table` and every cell render again.
- `tuning/callback_globals`: the `PropsFill` steps re-render because `member` inputs are off when `props` reaches a call (`fix-rc-callbacks`). On `again_clear`, React Compiler's cached value matches the uncompiled output because the global is back to its first value, so the step counts as sound for it.

## React Compiler wrong steps replaced

Only `tuning/callback_globals` has React Compiler steps that differ from uncompiled output. No step in `base`, `heldout` or `heldout2` was replaced.

| Step                       | RC count | Replaced by uncompiled |
| -------------------------- | -------- | ---------------------- |
| `GlobalMap/again`          | 0        | 0                      |
| `GlobalMap/clear_global`   | 0        | 0                      |
| `GlobalMemo/again`         | 0        | 1                      |
| `GlobalMemo/clear_global`  | 0        | 0                      |
| `GlobalPlain/again`        | 0        | 1                      |
| `GlobalPlain/clear_global` | 0        | 0                      |

The replacement raises React Compiler's total from 721 to 723 and `callback_globals` from 1 to 3.

## forgetti 0.8 (reported, not a threshold)

- Totals, wrong steps included: React 359 (next 633), Preact 337 (next 611).
- Wrong steps: 19 files on React, 18 on Preact. The step lists are in `regate/checks.txt` ("forgetti-0.8 wrong steps"). The files: `base/bailout`, `base/forloop`, `base/usectx`, `tuning/alias_branch`, `tuning/alias_closure`, `tuning/alias_field`, `tuning/alias_push`, `tuning/alias_spread`, `tuning/alias_unknown`, `tuning/callback_globals`, `tuning/discard_suspense_update` (React only), `tuning/hook_use_cond`, `tuning/loop_shapes`, `tuning/throw_boundary_swap`, `tuning/throw_call`, `tuning/throw_group`, `tuning/throw_row`, `heldout/dashboard_card`, `heldout/otp_input`.
- forgetti 0.8 is sound on every `heldout2` step. Its `heldout2` total is 61 on React, against next 259 and React Compiler 186.

Files where forgetti 0.8 is sound (0 wrong steps) and does less work than next, follow-up candidates:

| File                         | next R | forgetti 0.8 R | next P | forgetti 0.8 P |
| ---------------------------- | ------ | -------------- | ------ | -------------- |
| `base/hook`                  | 6      | 2              | 6      | 2              |
| `base/mutate`                | 2      | 1              | 2      | 1              |
| `tuning/hook_nested`         | 11     | 4              | 11     | 4              |
| `tuning/hook_object`         | 5      | 0              | 5      | 0              |
| `tuning/stable_children`     | 16     | 10             | 16     | 10             |
| `heldout/list_filters`       | 13     | 8              | 13     | 8              |
| `heldout/table_sort`         | 68     | 44             | 68     | 44             |
| `heldout/tree_view`          | 40     | 25             | 40     | 25             |
| `heldout2/discussions_table` | 64     | 1              | 64     | 1              |
| `heldout2/form_check`        | 41     | 5              | 41     | 5              |
| `heldout2/list_group`        | 5      | 2              | 5      | 2              |
| `heldout2/pagination`        | 13     | 7              | 13     | 7              |
| `heldout2/pricing_plans`     | 31     | 16             | 28     | 16             |
| `heldout2/toast_stack`       | 27     | 7              | 27     | 7              |
| `heldout2/toaster_store`     | 74     | 19             | 74     | 19             |

forgetti 0.8 pays for this in size. On `heldout2` its gzip is 1.7 to 3.3 times next's (`discussions_table` 8438 against 2564), and its `heldout2` total is 48916 against next 20659 (`regate/table.txt`).

## Gzip: `heldout` against `heldout2`

The prune threshold was tuned on `heldout/tree_view`. The size wins hold on `heldout2`: its total ratio is 0.844 (`heldout` 0.868), and its worst file is 1.025 (`heldout` 1.105). Above 1.0: two `heldout` files (`otp_input`, `tree_view`) and one `heldout2` file (`pricing_plans`), all within 1.15.

| `heldout` file    | next  | RC    | ratio | `heldout2` file     | next  | RC    | ratio |
| ----------------- | ----- | ----- | ----- | ------------------- | ----- | ----- | ----- |
| `cart_summary`    | 2006  | 2377  | 0.844 | `accordion`         | 2534  | 2553  | 0.993 |
| `dashboard_card`  | 1900  | 2634  | 0.721 | `discussions_table` | 2564  | 3501  | 0.732 |
| `form_validation` | 2500  | 2995  | 0.835 | `form_check`        | 2205  | 2548  | 0.865 |
| `hex_input`       | 1356  | 1545  | 0.878 | `list_group`        | 2638  | 3338  | 0.790 |
| `hue_slider`      | 2390  | 2582  | 0.926 | `pagination`        | 2427  | 3613  | 0.672 |
| `list_filters`    | 2571  | 3035  | 0.847 | `pricing_plans`     | 3044  | 2969  | 1.025 |
| `modal_effects`   | 1881  | 2423  | 0.776 | `toast_stack`       | 2231  | 2613  | 0.854 |
| `otp_input`       | 2447  | 2398  | 1.020 | `toaster_store`     | 3016  | 3354  | 0.899 |
| `table_sort`      | 2183  | 2625  | 0.832 |                     |       |       |       |
| `tree_view`       | 1806  | 1634  | 1.105 |                     |       |       |       |
| Total             | 21040 | 24248 | 0.868 | Total               | 20659 | 24489 | 0.844 |

Part of the `heldout2` size lead comes from caching less: next caches no element list in 4 of its files (see above).

## Compile time (not a threshold)

Sum of per-file medians over 62 files, React target: next 307.1 ms, forgetti 0.8 263.0 ms, React Compiler 459.4 ms. Each median is of 20 compiles in the gate run (`regate/compile-ms.ts` on `table.txt`). This is one run inside the gate, not the interleaved `bench.py` run of `final-gate`, so the noise is not measured. `heldout2` files take 14 to 47 ms each on next, against 9 to 22 ms on forgetti 0.8.

## Kill criteria

| Criterion                                                                                 | Measured                   | Fired           |
| ----------------------------------------------------------------------------------------- | -------------------------- | --------------- |
| A difference that cannot be fixed without bailing out more components than React Compiler | 0 differences              | no              |
| Total gzip above 1.3 times React Compiler                                                 | 0.804 (`heldout2` 0.844)   | no              |
| Token budget in `GOAL.md`                                                                 | judged by the orchestrator | not judged here |

## Full table

Per file. R is React, P is Preact. Work is renders plus recomputes over the update steps. "RC adj." is React Compiler's adjusted count, with its raw count in parentheses. "(N wrong)" marks forgetti 0.8 steps that differ from uncompiled output. Gzip and the compiled share are on React. "-" in P columns: the case runs on React only.

| file                           | next R | RC adj. R     | plain R | f0.8 R        | next P | plain P | f0.8 P        | gzip next | gzip RC | ratio | compiled next | compiled RC | work rules   |
| ------------------------------ | ------ | ------------- | ------- | ------------- | ------ | ------- | ------------- | --------- | ------- | ----- | ------------- | ----------- | ------------ |
| base/bailout                   | 2      | 2 (raw 2)     | 2       | 1 (1 wrong)   | 2      | 2       | 1 (1 wrong)   | 197       | 197     | 1.000 | 0/1           | 0/1         | pass         |
| base/callback                  | 1      | 1 (raw 1)     | 3       | 1             | 1      | 3       | 1             | 337       | 496     | 0.679 | 1/1           | 1/1         | pass         |
| base/deepprop                  | 1      | 1 (raw 1)     | 4       | 2             | 1      | 4       | 2             | 269       | 412     | 0.653 | 1/1           | 1/1         | pass         |
| base/derived                   | 2      | 4 (raw 4)     | 6       | 2             | 2      | 6       | 2             | 324       | 450     | 0.720 | 1/1           | 1/1         | pass         |
| base/earlyreturn               | 1      | 1 (raw 1)     | 7       | 2             | 1      | 7       | 2             | 414       | 579     | 0.715 | 1/1           | 1/1         | pass         |
| base/forloop                   | 11     | 11 (raw 11)   | 17      | 0 (3 wrong)   | 11     | 17      | 0 (3 wrong)   | 338       | 453     | 0.746 | 1/1           | 1/1         | pass         |
| base/hook                      | 6      | 6 (raw 6)     | 6       | 2             | 6      | 6       | 2             | 295       | 434     | 0.680 | 2/2           | 1/1         | pass         |
| base/jsxprops                  | 1      | 1 (raw 1)     | 6       | 4             | 1      | 6       | 4             | 315       | 457     | 0.689 | 1/1           | 1/1         | pass         |
| base/map                       | 2      | 7 (raw 7)     | 13      | 2             | 2      | 13      | 2             | 347       | 442     | 0.785 | 1/1           | 1/1         | pass         |
| base/mutate                    | 2      | 2 (raw 2)     | 6       | 1             | 2      | 6       | 1             | 314       | 496     | 0.633 | 1/1           | 1/1         | pass         |
| base/statememo                 | 1      | 1 (raw 1)     | 1       | 1             | 1      | 1       | 1             | 359       | 581     | 0.618 | 1/1           | 1/1         | pass         |
| base/switch                    | 2      | 2 (raw 2)     | 4       | 2             | 2      | 4       | 2             | 397       | 504     | 0.788 | 1/1           | 1/1         | pass         |
| base/ternary                   | 1      | 2 (raw 2)     | 3       | 1             | 1      | 3       | 1             | 282       | 393     | 0.718 | 1/1           | 1/1         | pass         |
| base/trycatch                  | 2      | 2 (raw 2)     | 4       | 2             | 2      | 4       | 2             | 330       | 482     | 0.685 | 1/1           | 1/1         | pass         |
| base/usectx                    | 0      | 0 (raw 0)     | 0       | 0 (1 wrong)   | 0      | 0       | 0 (1 wrong)   | 293       | 428     | 0.685 | 1/1           | 1/1         | pass         |
| tuning/alias_branch            | 4      | 4 (raw 4)     | 4       | 0 (2 wrong)   | 4      | 4       | 0 (2 wrong)   | 271       | 442     | 0.613 | 1/1           | 1/1         | pass         |
| tuning/alias_child             | 3      | 3 (raw 3)     | 8       | 4             | 3      | 8       | 4             | 323       | 489     | 0.661 | 1/1           | 1/1         | pass         |
| tuning/alias_closure           | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 193       | 471     | 0.410 | 1/1           | 1/1         | pass         |
| tuning/alias_field             | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 287       | 491     | 0.585 | 1/1           | 1/1         | pass         |
| tuning/alias_push              | 4      | 4 (raw 4)     | 4       | 0 (1 wrong)   | 4      | 4       | 0 (1 wrong)   | 274       | 444     | 0.617 | 1/1           | 1/1         | pass         |
| tuning/alias_spread            | 3      | 3 (raw 3)     | 3       | 0 (1 wrong)   | 3      | 3       | 0 (1 wrong)   | 274       | 457     | 0.600 | 1/1           | 1/1         | pass         |
| tuning/alias_unknown           | 4      | 4 (raw 4)     | 4       | 0 (2 wrong)   | 4      | 4       | 0 (2 wrong)   | 276       | 467     | 0.591 | 1/1           | 1/1         | pass         |
| tuning/callback_globals        | 8      | 3 (raw 1)     | 8       | 1 (9 wrong)   | 8      | 8       | 1 (9 wrong)   | 569       | 858     | 0.663 | 6/6           | 6/6         | **above RC** |
| tuning/control_assign          | 4      | 4 (raw 4)     | 4       | 4             | 4      | 4       | 4             | 411       | 611     | 0.673 | 4/4           | 4/4         | pass         |
| tuning/discard_strict          | 3      | 3 (raw 3)     | 10      | 3             | -      | -       | -             | 432       | 702     | 0.615 | 2/2           | 2/2         | pass         |
| tuning/discard_suspense_mount  | 6      | 6 (raw 6)     | 7       | 6             | 4      | 5       | 4             | 421       | 583     | 0.722 | 2/2           | 2/2         | pass         |
| tuning/discard_suspense_update | 4      | 9 (raw 9)     | 13      | 4 (5 wrong)   | -      | -       | -             | 423       | 584     | 0.724 | 2/2           | 2/2         | pass         |
| tuning/discard_transition      | 4      | 4 (raw 4)     | 21      | 10            | 4      | 15      | 8             | 403       | 693     | 0.582 | 1/1           | 1/1         | pass         |
| tuning/escaping_closure        | 11     | 11 (raw 11)   | 21      | 13            | 11     | 21      | 13            | 1054      | 1470    | 0.717 | 3/3           | 3/3         | pass         |
| tuning/hook_effect_event       | 2      | 2 (raw 2)     | 2       | 2             | -      | -       | -             | 305       | 541     | 0.564 | 1/1           | 1/1         | pass         |
| tuning/hook_nested             | 11     | 11 (raw 11)   | 15      | 4             | 11     | 15      | 4             | 404       | 613     | 0.659 | 3/3           | 2/2         | pass         |
| tuning/hook_object             | 5      | 5 (raw 5)     | 5       | 0             | 5      | 5       | 0             | 393       | 692     | 0.568 | 2/2           | 2/2         | pass         |
| tuning/hook_use_cond           | 1      | 6 (raw 6)     | 6       | 1 (1 wrong)   | 1      | 6       | 1 (1 wrong)   | 333       | 460     | 0.724 | 1/1           | 1/1         | pass         |
| tuning/loop_shapes             | 23     | 52 (raw 52)   | 75      | 11 (12 wrong) | 24     | 75      | 12 (12 wrong) | 941       | 1031    | 0.913 | 10/10         | 8/11        | pass         |
| tuning/stable_children         | 16     | 23 (raw 23)   | 35      | 10            | 16     | 35      | 10            | 1036      | 1296    | 0.799 | 5/5           | 5/5         | pass         |
| tuning/throw_boundary_swap     | 3      | 3 (raw 3)     | 4       | 2 (2 wrong)   | 3      | 4       | 1 (3 wrong)   | 619       | 844     | 0.733 | 2/2           | 2/2         | pass         |
| tuning/throw_call              | 3      | 3 (raw 3)     | 6       | 2 (3 wrong)   | 2      | 5       | 1 (5 wrong)   | 522       | 692     | 0.754 | 2/2           | 2/2         | pass         |
| tuning/throw_group             | 6      | 13 (raw 13)   | 13      | 5 (2 wrong)   | 4      | 11      | 3 (5 wrong)   | 618       | 729     | 0.848 | 2/2           | 2/2         | pass         |
| tuning/throw_row               | 16     | 28 (raw 28)   | 40      | 22 (2 wrong)  | 10     | 34      | 16 (4 wrong)  | 583       | 746     | 0.782 | 2/2           | 2/2         | pass         |
| heldout/cart_summary           | 19     | 24 (raw 24)   | 65      | 22            | 19     | 65      | 22            | 2006      | 2377    | 0.844 | 5/5           | 5/5         | pass         |
| heldout/dashboard_card         | 12     | 12 (raw 12)   | 54      | 23 (2 wrong)  | 12     | 54      | 23 (2 wrong)  | 1900      | 2634    | 0.721 | 4/4           | 2/5         | pass         |
| heldout/form_validation        | 25     | 25 (raw 25)   | 72      | 29            | 25     | 72      | 29            | 2500      | 2995    | 0.835 | 2/2           | 2/2         | pass         |
| heldout/hex_input              | 0      | 0 (raw 0)     | 0       | 0             | 0      | 0       | 0             | 1356      | 1545    | 0.878 | 3/3           | 1/4         | pass         |
| heldout/hue_slider             | 0      | 0 (raw 0)     | 0       | 0             | 0      | 0       | 0             | 2390      | 2582    | 0.926 | 4/4           | 1/5         | pass         |
| heldout/list_filters           | 13     | 13 (raw 13)   | 13      | 8             | 13     | 13      | 8             | 2571      | 3035    | 0.847 | 3/3           | 3/3         | pass         |
| heldout/modal_effects          | 10     | 10 (raw 10)   | 34      | 20            | 10     | 34      | 20            | 1881      | 2423    | 0.776 | 4/4           | 2/4         | pass         |
| heldout/otp_input              | 0      | 0 (raw 0)     | 0       | 0 (33 wrong)  | 0      | 0       | 0 (33 wrong)  | 2447      | 2398    | 1.020 | 1/2           | 0/6         | pass         |
| heldout/table_sort             | 68     | 158 (raw 158) | 212     | 44            | 68     | 212     | 44            | 2183      | 2625    | 0.832 | 2/2           | 2/2         | pass         |
| heldout/tree_view              | 40     | 40 (raw 40)   | 58      | 25            | 40     | 55      | 25            | 1806      | 1634    | 1.105 | 2/2           | 1/2         | pass         |

### `heldout2`

| file                       | next R | RC adj. R   | plain R | f0.8 R | next P | plain P | f0.8 P | gzip next | gzip RC | ratio | compiled next | compiled RC | work rules   |
| -------------------------- | ------ | ----------- | ------- | ------ | ------ | ------- | ------ | --------- | ------- | ----- | ------------- | ----------- | ------------ |
| heldout2/accordion         | 4      | 4 (raw 4)   | 4       | 4      | 4      | 4       | 4      | 2534      | 2553    | 0.993 | 9/10          | 5/10        | pass         |
| heldout2/discussions_table | 64     | 22 (raw 22) | 64      | 1      | 64     | 64      | 1      | 2564      | 3501    | 0.732 | 18/18         | 17/18       | **above RC** |
| heldout2/form_check        | 41     | 38 (raw 38) | 41      | 5      | 41     | 41      | 5      | 2205      | 2548    | 0.865 | 6/6           | 3/19        | **above RC** |
| heldout2/list_group        | 5      | 5 (raw 5)   | 5       | 2      | 5      | 5       | 2      | 2638      | 3338    | 0.790 | 8/9           | 7/9         | pass         |
| heldout2/pagination        | 13     | 13 (raw 13) | 13      | 7      | 13     | 13      | 7      | 2427      | 3613    | 0.672 | 8/8           | 7/11        | pass         |
| heldout2/pricing_plans     | 31     | 38 (raw 38) | 48      | 16     | 28     | 39      | 16     | 3044      | 2969    | 1.025 | 3/3           | 2/7         | pass         |
| heldout2/toast_stack       | 27     | 21 (raw 21) | 27      | 7      | 27     | 27      | 7      | 2231      | 2613    | 0.854 | 9/10          | 5/13        | **above RC** |
| heldout2/toaster_store     | 74     | 45 (raw 45) | 74      | 19     | 74     | 74      | 19     | 3016      | 3354    | 0.899 | 6/6           | 3/7         | **above RC** |
| Total `heldout2`           | 259    | 186         | 276     | 61     | 256    | 267     | 61     | 20659     | 24489   | 0.844 | 67/70         | 49/94       |              |
