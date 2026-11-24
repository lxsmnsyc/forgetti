# Review: corpus-heldout-3

Branch `feat/corpus-heldout-3` (2929b9e, cbe0715), read with `git diff batch/compiler-rewrite...feat/corpus-heldout-3`. Checked against `expectations.md`.

## Verdict

Approve with one should-fix. No blocking findings. The set is real-shaped and close to verbatim. It is deterministic and sound for plain against React Compiler, and its hashes are correct.

## Evidence

- **Test.** `pnpm -C <worktree> --filter compare test --set heldout3`: exit 0, 27 passed, 4 skipped. `heldout3.test.ts:64` calls `collect` with `compilers: ['plain']` only. No other test reads `COMPARE_SETS` for `heldout3`. `cli.ts:38` defaults to `base`, so no default run opens the set.
- **Soundness and determinism.** I ran `scratch/totals.ts` again with `plain` and `react-compiler` only. Every row matches `outcome.md`. The totals are 650 / 650 / 561 with 0 differences. This is my run against the worker's earlier run, so the numbers repeat.
- **Hashes.** I checked all 61 SHA-256 lines in `outcome.md` with `shasum -a 256 -c`. All 61 are OK. `find` shows 61 files in `benchmarks/corpus/heldout3/`, so no file is missing from the list and none is extra.
- **Sources compared to upstream at the cited commit:**
  - `switch/input.jsx` against `react-component/switch` `src/index.tsx`. Switch is identical apart from types and the named imports.
  - `rate/input.jsx` and `rate/star.jsx` against `src/Rate.tsx` and `src/Star.tsx`. Identical apart from types, imports and `bump('Row')`.
  - `clock/input.jsx` and `clock/mark.jsx` against `react-clock` `Clock.tsx` and `Mark.tsx`. Identical apart from types and docs.
  - `year_view/tile.jsx` and the `Months` part of `year_view/input.jsx` against `react-calendar` `Tile.tsx` and `YearView/Months.tsx`. Identical.
  - `product_page/variant_selector.jsx`, `cart_context.jsx` and `add_to_cart.jsx` against `vercel/commerce`. Identical, except the React 19 replacements that `adaptation` lists: `formAction` to `onClick`, `action` to `onSubmit`, `useActionState` to a state hook, and `use` plus `useOptimistic` to a reducer in the provider.
- **Licenses.** The GitHub API gives MIT for `vercel/commerce`, `wojtekmaj/react-calendar` and `react-component/steps`.
- **No reused sources.** A grep of every corpus `meta.json` for `react-component`, `wojtekmaj` and `vercel/commerce` finds only `heldout3`.
- **Scenarios.** Every `scenarios.js` imports only `../../shared/scenarios.js`, never a sibling.
- **Multi-file.** 7 of 8 cases are multi-file. The splits follow the upstream files. Stand-ins are folded into the upstream util modules and listed in each `adaptation`.
- **Seal.** No `next` or forgetti 0.8 run or output appears in the node folder or the diff. The only mention is the warning at `outcome.md:132`.
- **Existing sets and tests.** None changed. The diff adds only `heldout3/**`, `test/heldout3.test.ts` and node docs.
- **Dead steps.** In a plain run on React, the steps with zero work are the intended controls: same value set again, a click on a disabled item, a second click on the same item, a dropdown close. The one exception is in the nits.

## Judgment of the reported deviations

- **`test/heldout3.test.ts`:** accepted. It is a new file and copies `heldout2.test.ts`. The 600-line cap counts the input plus siblings, which multi-file cases need (`product_page` has 534 lines). The two extra normalizations remove only Preact serialization differences: the `suppressHydrationWarning` attribute and `0px` against `0`. Existing tests are not weakened.
- **react-tabs dropped and a second vercel/commerce case added:** accepted. Both are in `log.md`. `vercel/commerce` was already on the source list committed in 2929b9e.
- **Types removed, cases kept as `.jsx`:** accepted. heldout2 did the same, and the `.tsx` sibling failure is a harness bug that another node fixes.
- **`scratch/totals.ts` committed:** accepted. It names only `plain` and `react-compiler`.

## Findings

### Should-fix

1. **`docs/roadmaps/compiler-rewrite/nodes/corpus-heldout-3/scratch/rc-events.mjs:8-33` runs React Compiler outside the harness.**
   - The script loads `babel-plugin-react-compiler` and calls `babel.transformSync` on every `heldout3` module.
   - The roadmap `CLAUDE.md` says React Compiler is run "only through the harness in `benchmarks/compare/`".
   - It prints logger events, not compiled code or compiler source, so the seal holds.
   - Failure scenario: once committed, the script is a second way to run a compiler on a sealed set. A later agent can point it at another plugin, such as forgetti 0.8, which the harness `--compiler` flags would otherwise guard.
   - Fix: remove the script from the commit and keep its finding (the Babel 8 `CompileError` reasons) as prose in `outcome.md`, where it already is.

### Nits

2. **Recompute counters sit only in new harness-entry helpers that are already wrapped in `useMemo` by hand.** Each case has one: `describeTime`, `describeScore`, `findSelectedVariant`, `sumPercent`, `countEnabled`, `countDone`, `describeQuery`, `describeValue`.
   - Upstream work done on every render is not counted. Examples are the `combinations` reduce in `VariantSelector` and the stroke math in `Circle`.
   - The recompute half of the metric therefore barely separates compilers. Plain already caches every counted helper.
   - The counters do not favor any one compiler, and heldout2 used the same pattern. This is recorded as a limit of the set, not a defect.
3. **`progress/scenarios.js:13` (`steps` variant) gives 0 work in plain.**
   - In step mode `Circle` renders bare `<circle>` elements, not `PtgCircle`, and `Circle` itself has no counter. So this prop change measures nothing.
   - Harmless, but it is a dead step.
4. **`product_page/cart_context.jsx:141-144`: the stand-in shares one reducer through the context.** Upstream keeps `useOptimistic` state separate in each `useCart` consumer.
   - With the stand-in, an add re-renders `CartButton`. Upstream would not update `CartButton` until the server revalidates.
   - `adaptation` documents the change, and it is a reasonable Preact-safe substitute. It changes which components re-render on `add`.
5. **`outcome.md:12` says `year_view` has 7 modules. It has 8:** input, `month`, `tile`, `tile_group`, `flex`, `utils`, `date_formatter` and `dates`.
6. **`progress/util.js:16-22`: `useId` uses a module-level counter, so ids depend on mount order within a cell.**
   - Plain and the compiler under test run the same order in one run, so comparisons hold.
   - A partial run (`only`) prints different ids. `outcome.md` already notes this.
7. **No test checks soundness against React Compiler.** The 0-difference claim rests on `scratch/totals.ts`, as it did for heldout2.
   - `gate-3` will check it. A test would need to name `react-compiler`, which is allowed, but no test does yet.
8. **`clock` prints `toLocaleTimeString` output, which depends on the Node and ICU version (for example U+202F before `PM`).**
   - Comparisons within one run are not affected. HTML saved on one machine and compared on another could differ.

## Out of scope, noted

- React Compiler under the harness's Babel 8 compiles few library components. Examples: `clock` 1 of 26 functions, `steps` 3 of 17. This comes from default destructuring and computed keys. `outcome.md:128` records it, and another node moves React Compiler to Babel 7. Until that lands, the React Compiler numbers on `heldout3` (561) understate it.
