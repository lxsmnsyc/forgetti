# final-gate: hypothesis gate on the full corpus

Verdict: **missed**. No kill criterion fired.

- Commit measured: `987e99a` (`batch/compiler-rewrite` with `final-gate: set active`).
- Corpus: 46 files (15 `base`, 21 `tuning`, 10 `heldout`). The metric asks for at least 35 files and at least 10 held out: met by count. Only 9 held-out files are unexposed, since `heldout/hex_input` was seen before the gate (next line).
- Targets: React 19.3.1 and Preact 11.2.0. React Compiler 1.0.0 runs on React only.
- Command: `pnpm --filter compare gate --set base --set tuning --set heldout` (exit 1). The gate output lines are in `final-gate/checks.txt`. The harness tables (sizes, slots, compile ms, every scenario step) are in `final-gate/table.txt`. The per-file work readings are in `final-gate/analysis.txt`.
- Machine: 8 cores, 8 GB RAM, Node 26.12.1.
- `heldout/hex_input` is marked **seen**: the user and orchestrator saw its compiled output and row before this gate. It adds no work (no counted components), so it changes no work result. Its gzip ratio is 0.925, so the gzip results do not change without it. Excluding it, the compiled share is next 26 of 28 against React Compiler 18 of 34: still a pass.

## Thresholds

Thresholds as fixed in `docs/roadmaps/compiler-rewrite/debate/debate.md` "Hypothesis".

| Threshold                                                | Measured                                               | Result   |
| -------------------------------------------------------- | ------------------------------------------------------ | -------- |
| 0 differences on every file and both targets             | React 0, Preact 0                                      | pass     |
| Total work strictly below forgetti 0.8, React            | next 461, forgetti 0.8 274                             | **miss** |
| Total work strictly below React Compiler, React          | next 461, React Compiler 500                           | pass     |
| Total work strictly below forgetti 0.8, Preact           | next 442, forgetti 0.8 252                             | **miss** |
| No file above the better of the two, React (strict)      | 25 of 46 files above                                   | **miss** |
| No file above the better of the two, Preact (strict)     | 25 of 43 files above                                   | **miss** |
| Total gzip at most 1.0 times React Compiler              | 33782 against 43834, ratio 0.771                       | pass     |
| No file above 1.15 times React Compiler gzip             | `heldout/tree_view` 1985 against 1634, ratio 1.215     | **miss** |
| Compiled share at least React Compiler's, held-out files | next 29 of 31 (0.935), React Compiler 19 of 38 (0.500) | pass     |

Work is child re-renders plus `costly()` recomputes over the update steps, as the harness counts it (`sumWork` in `src/metrics.ts`). The counts are exact; a second full run gave the same totals.

### Per-file work: strict and DIFF-excluded readings

forgetti 0.8 renders wrong output (DIFF) on some steps of 18 files on React and 17 on Preact. On several of those files its work count is lower than any sound compiler can reach (for example 0 on `base/forloop`).

- **Strict reading** (what the gate script does and what the hypothesis text says: "no file above the better of the two", with no exception for unsound rows). React: 25 files above. Preact: 25 files above.
- **Step-excluded reading**: drop every step where forgetti 0.8 is DIFF from all compilers' sums for that file, then compare. React: 21 files above. Preact: 21 files above. Totals in this reading: React next 408, forgetti 0.8 259, React Compiler 431; Preact next 400, forgetti 0.8 249. Total work still misses against forgetti 0.8.
- **File-excluded reading**: forgetti 0.8 is not a baseline on a file where it has any DIFF step; React Compiler (React) is the only baseline there, and on Preact the file has no baseline. React: 13 files above. Preact: 12 files above.

The hypothesis text supports the strict reading. The threshold misses in all three readings.

Files above the better baseline, React. "f08 DIFF" counts forgetti 0.8's differing steps on the file.

| File                       | next | forgetti 0.8 | React Compiler | f08 DIFF | Strict | Step-excluded (next / best) | File-excluded (next / best) |
| -------------------------- | ---- | ------------ | -------------- | -------- | ------ | --------------------------- | --------------------------- |
| base/bailout               | 2    | 1            | 2              | 1        | miss   | pass (1 / 1)                | pass (2 / 2)                |
| base/callback              | 3    | 1            | 1              | 0        | miss   | miss (3 / 1)                | miss (3 / 1)                |
| base/forloop               | 11   | 0            | 11             | 3        | miss   | miss (3 / 0)                | pass (11 / 11)              |
| base/hook                  | 6    | 2            | 6              | 0        | miss   | miss (6 / 2)                | miss (6 / 2)                |
| base/jsxprops              | 6    | 4            | 1              | 0        | miss   | miss (6 / 1)                | miss (6 / 1)                |
| base/mutate                | 4    | 1            | 2              | 0        | miss   | miss (4 / 1)                | miss (4 / 1)                |
| base/trycatch              | 4    | 2            | 2              | 0        | miss   | miss (4 / 2)                | miss (4 / 2)                |
| tuning/alias_branch        | 4    | 0            | 4              | 2        | miss   | miss (2 / 0)                | pass (4 / 4)                |
| tuning/alias_closure       | 4    | 0            | 4              | 1        | miss   | miss (3 / 0)                | pass (4 / 4)                |
| tuning/alias_field         | 4    | 0            | 4              | 1        | miss   | miss (3 / 0)                | pass (4 / 4)                |
| tuning/alias_push          | 4    | 0            | 4              | 1        | miss   | miss (3 / 0)                | pass (4 / 4)                |
| tuning/alias_spread        | 3    | 0            | 3              | 1        | miss   | miss (2 / 0)                | pass (3 / 3)                |
| tuning/alias_unknown       | 4    | 0            | 4              | 2        | miss   | miss (2 / 0)                | pass (4 / 4)                |
| tuning/hook_nested         | 11   | 4            | 11             | 0        | miss   | miss (11 / 4)               | miss (11 / 4)               |
| tuning/hook_object         | 5    | 0            | 5              | 0        | miss   | miss (5 / 0)                | miss (5 / 0)                |
| tuning/loop_shapes         | 23   | 11           | 52             | 12       | miss   | miss (13 / 11)              | pass (23 / 52)              |
| tuning/throw_boundary_swap | 3    | 2            | 3              | 2        | miss   | pass (2 / 2)                | pass (3 / 3)                |
| tuning/throw_call          | 3    | 2            | 3              | 3        | miss   | pass (1 / 1)                | pass (3 / 3)                |
| tuning/throw_group         | 6    | 5            | 13             | 2        | miss   | pass (2 / 2)                | pass (6 / 13)               |
| heldout/cart_summary       | 54   | 22           | 24             | 0        | miss   | miss (54 / 22)              | miss (54 / 22)              |
| heldout/dashboard_card     | 32   | 23           | 12             | 2        | miss   | miss (28 / 12)              | miss (32 / 12)              |
| heldout/form_validation    | 72   | 29           | 25             | 0        | miss   | miss (72 / 25)              | miss (72 / 25)              |
| heldout/list_filters       | 13   | 8            | 13             | 0        | miss   | miss (13 / 8)               | miss (13 / 8)               |
| heldout/table_sort         | 77   | 44           | 158            | 0        | miss   | miss (77 / 44)              | miss (77 / 44)              |
| heldout/tree_view          | 40   | 25           | 40             | 0        | miss   | miss (40 / 25)              | miss (40 / 25)              |

On Preact the same 25 files are above in the strict reading (forgetti 0.8 is the only baseline). Differences from the React rows: `base/jsxprops` 6 against 4, `tuning/loop_shapes` 24 against 12, `tuning/throw_boundary_swap` 3 against 1, `tuning/throw_call` 2 against 1, `tuning/throw_group` 4 against 3, `heldout/dashboard_card` 32 against 23. Every Preact row is in `final-gate/analysis.txt`.

Of the six held-out files above, three miss even against React Compiler alone (the only baseline that is sound on every step): `cart_summary` 54 against 24, `dashboard_card` 32 against 12, `form_validation` 72 against 25. `list_filters` (13), `table_sort` (77 against 158) and `tree_view` (40) are at or below React Compiler and miss only against forgetti 0.8, which is sound on those three files.

Where the held-out work comes from (React steps, see `final-gate/table.txt`):

- `cart_summary`: next re-renders 3 or 4 children on every step, `same` included (r3), where React Compiler re-renders 0.
- `form_validation`: next bails out of `SignupForm` (`escaping-closure`), so its work equals uncompiled output (72).
- `dashboard_card` (12 update steps): next re-renders 1 child on every step, `same` included, where React Compiler re-renders 0 (12 renders). It also recomputes once more than React Compiler on 8 steps (c1 against c0 on `same`, `new_title`, `new_history`, `new_quotes`, `sort_change`, `collapse`, `sort_symbol`; c5 against c4 on `interaction/expand`) and equals it on `one_price`, `one_currency`, `one_limit` and `tick_collapsed` (8 recomputes). The excess, 32 against 12, is those 12 renders plus 8 recomputes.
- `table_sort`: `sorting/by_age` is r19 against forgetti 0.8's r7.
- `tree_view`, `list_filters`: forgetti 0.8 keeps memo children from re-rendering on edits where next and React Compiler re-render them.

## Compile time on oxc

Not a threshold in the hypothesis. Measured as the brief asks (debate P6, S4).

- Method: perf-pass `bench.py`, 10 runs plus 2 warmup, interleaved across the three compilers. Each run starts the harness loader, compiles all 46 files for the React target with one compiler, and reports the sum of per-file medians (20 timed compiles per file, `compileSource` in `src/compilers.ts`). The new compiler is oxc-parser plus magic-string, loaded from source through Vite SSR as the gate loads it. forgetti 0.8 and React Compiler are Babel plugins (parse, transform, generate). Noise is 3 times the larger median absolute deviation of the two sides. The timing script is `final-gate/time.ts`. To rerun: make folders named `next`, `forgetti-0.8` and `react-compiler`, then from their parent run `bench.py --dir next=next --dir forgetti-0.8=forgetti-0.8 --dir react-compiler=react-compiler --runs 10 --warmup 2 --metric 'total_ms: ([\d.]+)' -- node <path to time.ts>`. The script reads the compiler from the folder name.

| Compiler           | Median ms (46 files) | Min   | Max   | MAD  | Against next                                                |
| ------------------ | -------------------- | ----- | ----- | ---- | ----------------------------------------------------------- |
| next (oxc)         | 95.31                | 92.62 | 102.9 | 1.87 | -                                                           |
| forgetti 0.8       | 151.2                | 141.8 | 166.6 | 4.08 | 1.59 times slower, difference 55.9 ms, noise 12.2 ms: real  |
| React Compiler 1.0 | 271.1                | 256.6 | 395   | 7.14 | 2.84 times slower, difference 175.8 ms, noise 21.4 ms: real |

The new compiler is faster than both, beyond the noise.

## Kill criteria

| Criterion                                                                                 | Measured                                                                   | Fired                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| A difference that cannot be fixed without bailing out more components than React Compiler | 0 differences                                                              | no                     |
| Total gzip above 1.3 times React Compiler after S3                                        | 0.771                                                                      | no                     |
| Spend above 800k tokens before S4                                                         | Overridden by `GOAL.md` (3.5M token budget, set by the user on 2026-11-21) | overridden, not judged |

## Notes on the measurement

- Gzip bytes are deterministic, so the size thresholds need no noise run. Gzip is measured on the React target against React Compiler. Preact gzip is in the table for reference.
- The compiled share counts units differently per compiler. The new compiler counts components and hooks. React Compiler counts one logger event per function it tried (`CompileSuccess`, `CompileError`, `PipelineError`), so its units (38) exceed the new compiler's (31) on the same files. The threshold compares the shares as the gate script computes them.
- The `tree-loops` review warned about nested `var` loops. No held-out file has a `for (var` loop, so no held-out row needed that check.
- The three `derived: false` held-out files (`hex_input`, `hue_slider`, `otp_input`) have no counted components. They test soundness, size and compiled share only.

## Full table

Per file and target. Work: child re-renders plus recomputes over the update steps. diff: steps whose output differs from uncompiled output. gzip: bytes of the compiled module. compiled: units compiled of units seen.

### react

| file                           | plain work | forgetti-0.8 work | react-compiler work | next work | forgetti-0.8 diff | react-compiler diff | next diff | plain gzip | forgetti-0.8 gzip | react-compiler gzip | next gzip | forgetti-0.8 compiled | react-compiler compiled | next compiled | note                   |
| ------------------------------ | ---------- | ----------------- | ------------------- | --------- | ----------------- | ------------------- | --------- | ---------- | ----------------- | ------------------- | --------- | --------------------- | ----------------------- | ------------- | ---------------------- |
| base/bailout                   | 2          | 1                 | 2                   | 2         | 1                 | 0                   | 0         | 197        | 814               | 197                 | 197       | 1/1                   | 0/1                     | 0/1           | gzip ratio 1.000       |
| base/callback                  | 3          | 1                 | 1                   | 3         | 0                 | 0                   | 0         | 177        | 529               | 496                 | 318       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.641       |
| base/deepprop                  | 4          | 2                 | 1                   | 1         | 0                 | 0                   | 0         | 147        | 533               | 412                 | 269       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.653       |
| base/derived                   | 6          | 2                 | 4                   | 2         | 0                 | 0                   | 0         | 172        | 554               | 450                 | 324       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.720       |
| base/earlyreturn               | 7          | 2                 | 1                   | 1         | 0                 | 0                   | 0         | 207        | 653               | 579                 | 414       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.715       |
| base/forloop                   | 17         | 0                 | 11                  | 11        | 3                 | 0                   | 0         | 194        | 760               | 453                 | 338       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.746       |
| base/hook                      | 6          | 2                 | 6                   | 6         | 0                 | 0                   | 0         | 188        | 644               | 434                 | 295       | 2/2                   | 1/1                     | 2/2           | gzip ratio 0.680       |
| base/jsxprops                  | 6          | 4                 | 1                   | 6         | 0                 | 0                   | 0         | 154        | 545               | 457                 | 244       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.534       |
| base/map                       | 13         | 2                 | 7                   | 2         | 0                 | 0                   | 0         | 163        | 508               | 442                 | 347       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.785       |
| base/mutate                    | 6          | 1                 | 2                   | 4         | 0                 | 0                   | 0         | 183        | 616               | 496                 | 294       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.593       |
| base/statememo                 | 1          | 1                 | 1                   | 1         | 0                 | 0                   | 0         | 260        | 590               | 581                 | 359       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.618       |
| base/switch                    | 4          | 2                 | 2                   | 2         | 0                 | 0                   | 0         | 186        | 756               | 504                 | 397       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.788       |
| base/ternary                   | 3          | 1                 | 2                   | 1         | 0                 | 0                   | 0         | 143        | 563               | 393                 | 282       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.718       |
| base/trycatch                  | 4          | 2                 | 2                   | 4         | 0                 | 0                   | 0         | 205        | 558               | 482                 | 205       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.425       |
| base/usectx                    | 0          | 0                 | 0                   | 0         | 1                 | 0                   | 0         | 163        | 525               | 428                 | 293       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.685       |
| tuning/alias_branch            | 4          | 0                 | 4                   | 4         | 2                 | 0                   | 0         | 162        | 567               | 442                 | 271       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.613       |
| tuning/alias_child             | 8          | 4                 | 3                   | 3         | 0                 | 0                   | 0         | 141        | 513               | 489                 | 323       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.661       |
| tuning/alias_closure           | 4          | 0                 | 4                   | 4         | 1                 | 0                   | 0         | 193        | 641               | 471                 | 193       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.410       |
| tuning/alias_field             | 4          | 0                 | 4                   | 4         | 1                 | 0                   | 0         | 175        | 664               | 491                 | 287       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.585       |
| tuning/alias_push              | 4          | 0                 | 4                   | 4         | 1                 | 0                   | 0         | 164        | 528               | 444                 | 274       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.617       |
| tuning/alias_spread            | 3          | 0                 | 3                   | 3         | 1                 | 0                   | 0         | 170        | 554               | 457                 | 274       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.600       |
| tuning/alias_unknown           | 4          | 0                 | 4                   | 4         | 2                 | 0                   | 0         | 163        | 554               | 467                 | 276       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.591       |
| tuning/control_assign          | 4          | 4                 | 4                   | 4         | 0                 | 0                   | 0         | 227        | 1396              | 611                 | 411       | 4/4                   | 4/4                     | 4/4           | gzip ratio 0.673       |
| tuning/discard_strict          | 10         | 3                 | 3                   | 3         | 0                 | 0                   | 0         | 307        | 825               | 702                 | 432       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.615       |
| tuning/discard_suspense_mount  | 7          | 6                 | 6                   | 6         | 0                 | 0                   | 0         | 246        | 788               | 583                 | 421       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.722       |
| tuning/discard_suspense_update | 13         | 4                 | 9                   | 4         | 5                 | 0                   | 0         | 248        | 793               | 584                 | 423       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.724       |
| tuning/discard_transition      | 21         | 10                | 4                   | 4         | 0                 | 0                   | 0         | 287        | 757               | 693                 | 465       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.671       |
| tuning/hook_effect_event       | 2          | 2                 | 2                   | 2         | 0                 | 0                   | 0         | 215        | 558               | 541                 | 305       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.564       |
| tuning/hook_nested             | 15         | 4                 | 11                  | 11        | 0                 | 0                   | 0         | 291        | 881               | 613                 | 404       | 3/3                   | 2/2                     | 3/3           | gzip ratio 0.659       |
| tuning/hook_object             | 5          | 0                 | 5                   | 5         | 0                 | 0                   | 0         | 269        | 813               | 692                 | 393       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.568       |
| tuning/hook_use_cond           | 6          | 1                 | 6                   | 1         | 1                 | 0                   | 0         | 235        | 650               | 460                 | 333       | 1/1                   | 1/1                     | 1/1           | gzip ratio 0.724       |
| tuning/loop_shapes             | 75         | 11                | 52                  | 23        | 12                | 0                   | 0         | 477        | 3473              | 1031                | 941       | 10/10                 | 8/11                    | 10/10         | gzip ratio 0.913       |
| tuning/throw_boundary_swap     | 4          | 2                 | 3                   | 3         | 2                 | 0                   | 0         | 441        | 991               | 844                 | 619       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.733       |
| tuning/throw_call              | 6          | 2                 | 3                   | 3         | 3                 | 0                   | 0         | 372        | 853               | 692                 | 522       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.754       |
| tuning/throw_group             | 13         | 5                 | 13                  | 6         | 2                 | 0                   | 0         | 469        | 1116              | 729                 | 618       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.848       |
| tuning/throw_row               | 40         | 22                | 28                  | 16        | 2                 | 0                   | 0         | 400        | 934               | 746                 | 583       | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.782       |
| heldout/cart_summary           | 65         | 22                | 24                  | 54        | 0                 | 0                   | 0         | 1275       | 3590              | 2377                | 2010      | 5/5                   | 5/5                     | 5/5           | gzip ratio 0.846       |
| heldout/dashboard_card         | 54         | 23                | 12                  | 32        | 2                 | 0                   | 0         | 1566       | 4711              | 2634                | 1942      | 4/4                   | 2/5                     | 4/4           | gzip ratio 0.737       |
| heldout/form_validation        | 72         | 29                | 25                  | 72        | 0                 | 0                   | 0         | 1650       | 3881              | 2995                | 1866      | 2/2                   | 2/2                     | 1/2           | gzip ratio 0.623       |
| heldout/hex_input              | 0          | 0                 | 0                   | 0         | 0                 | 0                   | 0         | 1222       | 2370              | 1545                | 1429      | 3/3                   | 1/4                     | 3/3           | seen, gzip ratio 0.925 |
| heldout/hue_slider             | 0          | 0                 | 0                   | 0         | 0                 | 0                   | 0         | 2027       | 3796              | 2582                | 2292      | 4/4                   | 1/5                     | 4/4           | gzip ratio 0.888       |
| heldout/list_filters           | 13         | 8                 | 13                  | 13        | 0                 | 0                   | 0         | 1710       | 4119              | 3035                | 2447      | 3/3                   | 3/3                     | 3/3           | gzip ratio 0.806       |
| heldout/modal_effects          | 34         | 20                | 10                  | 10        | 0                 | 0                   | 0         | 1390       | 3236              | 2423                | 1881      | 4/4                   | 2/4                     | 4/4           | gzip ratio 0.776       |
| heldout/otp_input              | 0          | 0                 | 0                   | 0         | 33                | 0                   | 0         | 2380       | 4487              | 2398                | 2447      | 2/2                   | 0/6                     | 1/2           | gzip ratio 1.020       |
| heldout/table_sort             | 212        | 44                | 158                 | 77        | 0                 | 0                   | 0         | 1463       | 3705              | 2625                | 2139      | 2/2                   | 2/2                     | 2/2           | gzip ratio 0.815       |
| heldout/tree_view              | 58         | 25                | 40                  | 40        | 0                 | 0                   | 0         | 1188       | 3115              | 1634                | 1985      | 2/2                   | 1/2                     | 2/2           | gzip ratio 1.215       |

### preact

| file                          | plain work | forgetti-0.8 work | next work | forgetti-0.8 diff | next diff | plain gzip | forgetti-0.8 gzip | next gzip | forgetti-0.8 compiled | next compiled | note |
| ----------------------------- | ---------- | ----------------- | --------- | ----------------- | --------- | ---------- | ----------------- | --------- | --------------------- | ------------- | ---- |
| base/bailout                  | 2          | 1                 | 2         | 1                 | 0         | 204        | 824               | 204       | 1/1                   | 0/1           |      |
| base/callback                 | 3          | 1                 | 3         | 0                 | 0         | 177        | 540               | 322       | 1/1                   | 1/1           |      |
| base/deepprop                 | 4          | 2                 | 1         | 0                 | 0         | 147        | 542               | 273       | 1/1                   | 1/1           |      |
| base/derived                  | 6          | 2                 | 2         | 0                 | 0         | 172        | 566               | 327       | 1/1                   | 1/1           |      |
| base/earlyreturn              | 7          | 2                 | 1         | 0                 | 0         | 207        | 665               | 416       | 1/1                   | 1/1           |      |
| base/forloop                  | 17         | 0                 | 11        | 3                 | 0         | 194        | 772               | 342       | 1/1                   | 1/1           |      |
| base/hook                     | 6          | 2                 | 6         | 0                 | 0         | 188        | 654               | 299       | 2/2                   | 2/2           |      |
| base/jsxprops                 | 6          | 4                 | 6         | 0                 | 0         | 154        | 555               | 248       | 1/1                   | 1/1           |      |
| base/map                      | 13         | 2                 | 2         | 0                 | 0         | 163        | 518               | 348       | 1/1                   | 1/1           |      |
| base/mutate                   | 6          | 1                 | 4         | 0                 | 0         | 183        | 629               | 298       | 1/1                   | 1/1           |      |
| base/statememo                | 1          | 1                 | 1         | 0                 | 0         | 264        | 600               | 364       | 1/1                   | 1/1           |      |
| base/switch                   | 4          | 2                 | 2         | 0                 | 0         | 186        | 767               | 402       | 1/1                   | 1/1           |      |
| base/ternary                  | 3          | 1                 | 1         | 0                 | 0         | 143        | 573               | 285       | 1/1                   | 1/1           |      |
| base/trycatch                 | 4          | 2                 | 4         | 0                 | 0         | 205        | 571               | 205       | 1/1                   | 1/1           |      |
| base/usectx                   | 0          | 0                 | 0         | 1                 | 0         | 174        | 542               | 308       | 1/1                   | 1/1           |      |
| tuning/alias_branch           | 4          | 0                 | 4         | 2                 | 0         | 162        | 579               | 275       | 1/1                   | 1/1           |      |
| tuning/alias_child            | 8          | 4                 | 3         | 0                 | 0         | 141        | 523               | 326       | 1/1                   | 1/1           |      |
| tuning/alias_closure          | 4          | 0                 | 4         | 1                 | 0         | 193        | 654               | 193       | 1/1                   | 1/1           |      |
| tuning/alias_field            | 4          | 0                 | 4         | 1                 | 0         | 175        | 674               | 292       | 1/1                   | 1/1           |      |
| tuning/alias_push             | 4          | 0                 | 4         | 1                 | 0         | 164        | 540               | 278       | 1/1                   | 1/1           |      |
| tuning/alias_spread           | 3          | 0                 | 3         | 1                 | 0         | 170        | 562               | 276       | 1/1                   | 1/1           |      |
| tuning/alias_unknown          | 4          | 0                 | 4         | 2                 | 0         | 163        | 567               | 278       | 1/1                   | 1/1           |      |
| tuning/control_assign         | 4          | 4                 | 4         | 0                 | 0         | 227        | 1408              | 413       | 4/4                   | 4/4           |      |
| tuning/discard_suspense_mount | 5          | 4                 | 4         | 0                 | 0         | 251        | 799               | 431       | 2/2                   | 2/2           |      |
| tuning/discard_transition     | 15         | 8                 | 4         | 0                 | 0         | 300        | 772               | 477       | 1/1                   | 1/1           |      |
| tuning/hook_nested            | 15         | 4                 | 11        | 0                 | 0         | 295        | 889               | 409       | 3/3                   | 3/3           |      |
| tuning/hook_object            | 5          | 0                 | 5         | 0                 | 0         | 273        | 823               | 398       | 2/2                   | 2/2           |      |
| tuning/hook_use_cond          | 6          | 1                 | 1         | 1                 | 0         | 243        | 664               | 344       | 1/1                   | 1/1           |      |
| tuning/loop_shapes            | 75         | 12                | 24        | 12                | 0         | 477        | 3487              | 944       | 10/10                 | 10/10         |      |
| tuning/throw_boundary_swap    | 4          | 1                 | 3         | 3                 | 0         | 447        | 1006              | 627       | 2/2                   | 2/2           |      |
| tuning/throw_call             | 5          | 1                 | 2         | 5                 | 0         | 373        | 865               | 527       | 2/2                   | 2/2           |      |
| tuning/throw_group            | 11         | 3                 | 4         | 5                 | 0         | 469        | 1127              | 623       | 2/2                   | 2/2           |      |
| tuning/throw_row              | 34         | 16                | 10        | 4                 | 0         | 401        | 944               | 588       | 2/2                   | 2/2           |      |
| heldout/cart_summary          | 65         | 22                | 54        | 0                 | 0         | 1285       | 3606              | 2022      | 5/5                   | 5/5           |      |
| heldout/dashboard_card        | 54         | 23                | 32        | 2                 | 0         | 1570       | 4720              | 1946      | 4/4                   | 4/4           |      |
| heldout/form_validation       | 72         | 29                | 72        | 0                 | 0         | 1654       | 3891              | 1868      | 2/2                   | 1/2           |      |
| heldout/hex_input             | 0          | 0                 | 0         | 0                 | 0         | 1226       | 2377              | 1432      | 3/3                   | 3/3           | seen |
| heldout/hue_slider            | 0          | 0                 | 0         | 0                 | 0         | 2044       | 3809              | 2307      | 4/4                   | 4/4           |      |
| heldout/list_filters          | 13         | 8                 | 13        | 0                 | 0         | 1722       | 4132              | 2459      | 3/3                   | 3/3           |      |
| heldout/modal_effects         | 34         | 20                | 10        | 0                 | 0         | 1393       | 3246              | 1885      | 4/4                   | 4/4           |      |
| heldout/otp_input             | 0          | 0                 | 0         | 33                | 0         | 2392       | 4504              | 2457      | 2/2                   | 1/2           |      |
| heldout/table_sort            | 212        | 44                | 77        | 0                 | 0         | 1467       | 3712              | 2143      | 2/2                   | 2/2           |      |
| heldout/tree_view             | 55         | 25                | 40        | 0                 | 0         | 1199       | 3130              | 1998      | 2/2                   | 2/2           |      |
