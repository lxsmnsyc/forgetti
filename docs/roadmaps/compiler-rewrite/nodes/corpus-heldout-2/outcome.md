# Outcome: corpus-heldout-2

## Built

`benchmarks/corpus/heldout2/` has 8 cases from 4 repositories. Each is `input.jsx`, `scenarios.js` and `meta.json` in the `heldout` layout. All run on React 19 and Preact 11. All are `derived: false`: mostly vendored code with edits, partly rewritten, as listed in each `adaptation`.

No `next` or forgetti 0.8 output was produced, run or seen for this set. Every harness run named `--compiler plain --compiler react-compiler`. `gate` was not run on `heldout2`. The new test names `plain` only.

| Case | Source (all MIT) | Lines | Exercises |
| --- | --- | --- | --- |
| `form_check` | react-bootstrap v2.10.10 `FormCheck`, `FormCheckInput`, `FormCheckLabel`, `Feedback` | 243 | spread props, forwardRef, theme and form context consumers, keyed list |
| `toast_stack` | react-bootstrap v2.10.10 `Toast`, `ToastHeader`, `ToastBody`, `CloseButton`; react-restart/hooks 4de925b hooks | 250 | autohide timer effect with cleanup, refs set in an effect, context in the header, keyed list |
| `list_group` | react-bootstrap v2.10.10 `ListGroup`, `ListGroupItem` | 233 | per-item context consumer, event callback hook, mutated spread props, keyed list, memo child |
| `accordion` | react-bootstrap v2.10.10 `Accordion`, `AccordionItem`, `AccordionButton`, `AccordionHeader` | 236 | three context levels, memoized context values, click handler built in render, keyed list, memo child |
| `pagination` | react-bootstrap v2.10.10 `Pagination`, `PageItem` | 203 | components made by a factory, spread props, theme context, keyed list, memo child |
| `toaster_store` | timolins/react-hot-toast e725d38 `store`, `use-toaster`, `toaster` | 247 | subscribe effect with cleanup, one timer per toast with cleanup, many `useCallback` handlers, ref callback, memo child |
| `pricing_plans` | vercel/nextjs-subscription-payments bdd0813 `Pricing`, `Button` | 239 | app page with state, async click handler, forwardRef button with merged refs and spread props, keyed list |
| `discussions_table` | alan2207/bulletproof-react 9506629 `table`, `pagination`, `discussions-list` | 249 | data table whose cell components are new functions each render, forwardRef parts, keyed rows and columns, per-row child |

Source URL, license and tag or commit are in each `meta.json`. Licenses were read from the GitHub API. Two repositories are apps (nextjs-subscription-payments, bulletproof-react). kentcdodds/bookshelf was rejected because GitHub reports no standard license for it.

Scenarios: every case has a `same` step, prop variants (some pass equal content in a new array or object), context steps where the case reads a context, and state steps through setters stored on `globalThis` (or the exported `dispatch` for `toaster_store`). Child renders are counted by `bump('Child')`, `bump('Row')` or `bump('Btn')` in leaf and memo components. Recomputes are counted by a helper that calls `bump('<name>')` and returns the value it computes (`findMatches`, `summarize`, `countUnread`, `findWindow`, `pickVisible`, `mergeToasts`, `listIntervals`, `formatPrice`, `formatDate`). This is the `costly()` pattern of `base/`. The first version put a bare `bump` inside `useMemo` callbacks, which React Compiler hoisted out of the cached block and so counted a marker call as a recompute. That is fixed.

Also added, outside the owned path (see Deviations): `benchmarks/compare/test/heldout2.test.ts`.

## Proof

Not a fix node.

## Result

Not an experiment node. Work totals are renders plus recomputes over all steps except mounts. A script (`collect` with `plain` and `react-compiler` only) printed them, so no number is summed by hand.

| Case | plain, React | plain, Preact | React Compiler, React |
| --- | --- | --- | --- |
| `accordion` | 4 | 4 | 4 |
| `discussions_table` | 64 | 64 | 22 |
| `form_check` | 41 | 41 | 38 |
| `list_group` | 5 | 5 | 5 |
| `pagination` | 13 | 13 | 13 |
| `pricing_plans` | 48 | 39 | 38 |
| `toast_stack` | 27 | 27 | 21 |
| `toaster_store` | 74 | 74 | 45 |
| Total | 276 | 267 | 186 |

Differences from uncompiled output: React Compiler on React, 0 steps in 8 cases (HTML and errors compared on every step including mounts). Plain gives the same normalized HTML on React and Preact for every step. React Compiler does not run on Preact. `pricing_plans` counts 9 more on React than on Preact for plain because of the async handler step.

## Deviations

- `benchmarks/compare/test/heldout2.test.ts` is new. It copies `heldout.test.ts` with the set name changed, a minimum of 8 cases and 4 source repositories. It is skipped unless `COMPARE_SETS` names `heldout2`, the same exclusion as `heldout`. No change to `benchmarks/compare/src/` was needed.
- `form_check` reads the children array directly in `hasChildOfType`. Upstream uses `React.Children.toArray`. The harness maps `Children` to `preact`, which has no such export.
- Upstream helpers from `@restart/ui`, `uncontrollable`, `classnames`, `react-merge-refs`, query hooks and routers are replaced by reduced local versions or props, listed in each `adaptation`. `toast_stack` and `toaster_store` drop parts that need real time or layout.
- Each library case adds a harness entry component because scenarios cannot build elements.
- The brief names React apps. Six cases come from component libraries (react-bootstrap, react-hot-toast). Two come from apps.

## Stubs left

- None.

## Gotchas

- `toaster_store` keeps its state in the module. `SeededToaster` clears and seeds the store on first render, and every scenario uses toaster id `t`. The scenario file explains why the real clock stays deterministic: 600000 ms durations and `createdAt` taken at load.
- `pricing_plans` exports a default component, so its scenarios use `component: 'default'`.
- `discussions_table` creates its cell components inline, so every parent render remounts every cell. A compiler that caches the columns array changes how often cells remount.
- Preact serializes controlled inputs differently from React, so compare HTML across targets only after the normalization in the test.
- Do not run `gate`, `table` or `test` for `heldout2` with `next` or `forgetti-0.8` before the regate. `table --set heldout2` without `--compiler` runs all four.
- `input.jsx` files are not formatted by `oxfmt`. `scenarios.js`, `meta.json` and the test are.
- A bare `bump` statement inside a memo callback is hoisted by React Compiler. Count recomputes with a helper whose return value feeds the result.

## Proposed learnings

- Name `--compiler plain --compiler react-compiler` on every harness run of a set that must stay clean | `table` and `gate` default to all four compilers | benchmarks/compare | no
- Count a recompute in a helper that returns the computed value, never in a bare statement | React Compiler hoists a bare marker out of cached blocks and inflates its count | benchmarks/corpus | no

## Verification

- `pnpm --filter compare test --set heldout2`: pass, 13 passed and 2 skipped (2 new tests: 8 or more cases from 4 repositories of 100 to 250 lines with an allowed license; no errors and the same normalized HTML on React and Preact).
- `pnpm --filter compare test`: pass, 11 passed and 4 skipped.
- Totals script through `pnpm --filter compare exec`, plain and React Compiler only: 8 cases, 0 differences.
- `rtk proxy pnpm lint`: warnings only, none in the new files.
- `pnpm format:check`: pass.
- `pnpm --filter forgetti test`: not rerun after the fix, since no package source changed (546 passed on the first commit).

## Size

- Estimated M, actual M.
