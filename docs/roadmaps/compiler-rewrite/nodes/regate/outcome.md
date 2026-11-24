# Outcome: regate

## Built

- `benchmarks/compare/src/gate.ts`: the amendment-1 thresholds, committed alone and first (`9cf2749`).
  - React work against React Compiler, with every React Compiler step that differs from uncompiled output charged at the uncompiled count (`sumBaselineWork`). The replaced steps are listed.
  - Preact work against uncompiled output.
  - Gzip and compiled share as before. The share is taken on every `heldout*` set.
  - Every rule runs on all chosen sets, then on `heldout2` alone.
  - forgetti 0.8 is reported only (`INFO` lines): totals, wrong steps, and files where it is sound and below next. One `INFO file` line per file, `heldout2` last.
- `benchmarks/compare/test/gate.test.ts`: 6 tests for the new rules.
- `benchmarks/compare/results/regate.md`: the report.
- `benchmarks/compare/results/regate/`: `checks.txt`, `table.txt`, `per-file.md`, `run2/checks.txt` (repeat run), `pre-heldout2/` (check run on `base`, `tuning`, `heldout` before `heldout2` was read), and three scripts: `save.ts` (one `collect`, writes the gate and table outputs), `per-file.ts` (Markdown table from `checks.txt`), `compile-ms.ts` (sums the compile ms column).

## Proof

Not a fix node.

## Result

- result: **missed**, against `debate/amendment-1.md`. No kill criterion fired. The roadmap stops here.
- Missed thresholds:
  - React, no file above React Compiler: 5 files above, all sets.
  - React, total work strictly below React Compiler, on `heldout2` alone: next 259 against 186.
- Thresholds, all sets (`base`, `tuning`, `heldout`, `heldout2`; 62 files) and `heldout2` alone (8 files):

| Threshold | All sets | `heldout2` |
| --- | --- | --- |
| 0 differences, React and Preact | 0 and 0, pass | 0 and 0, pass |
| React total work below React Compiler | 633 against 723, pass | 259 against 186, **miss** |
| React, no file above React Compiler | 5 above, **miss** | 4 above, **miss** |
| Preact total work below uncompiled | 611 against 1128, pass | 256 against 267, pass |
| Preact, no file above uncompiled | 0 above, pass | 0 above, pass |
| Total gzip at most 1.0 times React Compiler | 0.804, pass | 0.844, pass |
| No file above 1.15 times React Compiler gzip | worst 1.105 (`heldout/tree_view`), pass | worst 1.025 (`pricing_plans`), pass |
| Compiled share on held-out files | 97/101 against 68/132, pass | 67/70 against 49/94, pass |

- React Compiler wrong steps replaced: only `tuning/callback_globals`, 6 steps (`GlobalMap`, `GlobalMemo`, `GlobalPlain`, each `again` and `clear_global`). Counts change on `GlobalMemo/again` and `GlobalPlain/again` (0 to 1). React Compiler total 721 becomes 723.
- On `heldout2`, next does the uncompiled work on every step of 7 of 8 files. Only `pricing_plans` is lower. forgetti 0.8 is sound on all of `heldout2` and totals 61 there, at 2.4 times next's gzip (48916 against 20659).
- Gzip, `heldout` against `heldout2`: totals 0.868 and 0.844, worst files 1.105 (`tree_view`) and 1.025 (`pricing_plans`). The size wins hold on the clean set.
- Kill criteria, none fired:
  - 0 differences.
  - Total gzip 0.804, under 1.3.
  - Token budget not judged here.
- Compile time (reported only): next 307.1 ms, forgetti 0.8 263.0 ms, React Compiler 459.4 ms, sums of per-file medians in one gate run. Not the interleaved `bench.py` method of `final-gate`, so noise is not measured.
- reproduce: commit `9cf2749`, `pnpm install`, `pnpm build`, `pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2` (exit 1). Node 26.12.1, macOS, 8 cores, 8 GB RAM. Three full runs gave identical gate output and step counts.

Proposed follow-up nodes, one line each:

- `event-closure-globals`: a closure that only runs on an event and reads a global that is not stable (`onClose: () => globalThis.__toasts.dismiss(id)`) is refused, so its element is rebuilt; `heldout2/toast_stack` 27 against React Compiler 21, `heldout2/form_check` 41 against 38. Closures that render calls must stay refused (`tuning/callback_globals`).
- `map-list-cache`: an element list from `.map(fn)` is not cached as a whole when `fn` calls a method on an input (`selected.includes`, `handlers.calculateOffset`); `heldout2/toaster_store` 74 against 45, `heldout2/form_check` 41 against 38, `heldout2/toast_stack` 27 against 21.
- `object-method-closures`: an array of objects with methods that capture a prop (`columns` with `Cell` methods in `DiscussionsList`) is rebuilt every render; `heldout2/discussions_table` 64 against 22.
- `props-fill-member`: `member` inputs are off when `props` reaches a call, so `PropsFill` re-renders on equal props; `tuning/callback_globals` 8 against 3 (3 `PropsFill` steps r1 against r0, 2 `again_clear` steps c1 against c0).
- `forgetti-sound-lower`: files where forgetti 0.8 is sound and below next; `base/hook` 6 against 2, `tuning/hook_object` 5 against 0, `heldout/table_sort` 68 against 44, `heldout/tree_view` 40 against 25, and every `heldout2` file except `accordion` (full list in `regate.md`).

## Deviations

- `benchmarks/compare/test/gate.test.ts` is outside the brief's owned paths. The task asked for a unit test of the new rules, and that file is the gate test.
- Outputs are written by `results/regate/save.ts`, which runs one `collect` and calls the same `runGate` and report functions as `cli.ts`. The gate's stderr carries many React warnings, and the table is 700 lines, so saving through a script was simpler than copying output. The CLI command was run once too, with stdout saved and compared: identical to `checks.txt`, exit 1.
- The compiled share uses every `heldout*` set as held-out files (`heldout` and `heldout2`), as the task asked. The old gate used `heldout` only.
- I read the compiled `next` output of four `heldout2` files after the gate ran, to name the causes in the follow-ups. `heldout2` is now exposed in the same way `heldout` was.

## Stubs left

- None.

## Gotchas

- `save.ts` must run with `benchmarks/compare` as the working directory (`pnpm --filter compare exec node results/regate/save.ts <out> <set>...`). From the repo root every uncompiled cell fails to load, and `sumWork(plain, plain)` in `src/metrics.ts` then recurses until the stack overflows. `metrics.ts` is not owned and was not changed.
- `per-file.ts` writes a table that `oxfmt` reformats. Run `pnpm exec oxfmt` on its output.
- The amendment-1 rule replaces React Compiler counts per step. On `callback_globals` `again_clear`, React Compiler's stale cache gives output equal to uncompiled, so the step counts as sound and its 0 stays. Judged per scenario, its adjusted count would be 5, and the file still misses (8 against 5).
- The new `INFO` lines never fail the gate. `cli.ts` exits 1 only on `FAIL` lines.

## Proposed learnings

- Run harness scripts with `benchmarks/compare` as the working directory | from the repo root every uncompiled cell fails to load and `sumWork` recurses on the failed cell | benchmarks/compare | yes (`sumWork` could throw on a failed uncompiled cell)
- A planner rule tuned on exposed files must be checked on a clean set before a gate | every fix since `final-gate` closed its target `heldout` file, and `heldout2` showed the same patterns (stable children, lists, closures) unfixed | docs/roadmaps | no

## Verification

- `pnpm build`: pass.
- `pnpm --filter forgetti test`: 25 files, 546 tests pass.
- `pnpm --filter compare test`: 15 passed, 4 skipped (held-out tests skip without `--set`).
- `rtk proxy pnpm lint`: 0 errors, 14 warnings (none in changed files).
- `pnpm format:check`: pass after `oxfmt` on the report files.
- `pnpm typecheck`: pass. `pnpm --filter compare typecheck`: pass.
- `pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2`: exit 1, thresholds missed as reported.

## Size

- Estimated M, actual M.
