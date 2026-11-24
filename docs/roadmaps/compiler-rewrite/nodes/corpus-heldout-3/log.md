# Log: corpus-heldout-3

## Sources, chosen before any case was built

Repositories used by earlier sets (from the `source` fields of base, tuning, heldout and heldout2): react-hook-form, TanStack/table, excalidraw, react-otp-input, reduxjs/redux, tastejs/todomvc, react-colorful, react-bootstrap, react-hot-toast, vercel/nextjs-subscription-payments, bulletproof-react. None of them is used here.

Licenses read from the GitHub API on 2026-11-23. Commits are the default branch heads on that day.

| Repository | License | Commit | Planned case | Files |
| --- | --- | --- | --- | --- |
| wojtekmaj/react-clock | MIT | 82fcaefa788d6d5cbde839d12736a4edb92be362 | `clock` | `packages/react-clock/src/Clock.tsx`, `Hand.tsx`, `Mark.tsx`, `MarkNumber.tsx`, `shared/*` |
| wojtekmaj/react-calendar | MIT | 1e423045a85a226f29332d019448427dd7c1c334 | `month_view` | `packages/react-calendar/src/MonthView.tsx`, `MonthView/*`, `Tile.tsx`, `TileGroup.tsx`, `Flex.tsx`, `shared/*` |
| reactjs/react-tabs | MIT | 689c34084d4fd14dda01d97aa55c872fe29fb3cb | `tabs` | `src/components/*`, `src/helpers/*` |
| react-component/rate | MIT | 78030fa08ff6a626ed0079ed79ad5e475931cef9 | `rate` | `src/Rate.tsx`, `src/Star.tsx`, `src/useRefs.ts`, `src/util.ts` |
| react-component/steps | MIT | d1060e22f700db45f223dab3622962e989408198 | `steps` | `src/Steps.tsx`, `src/Step.tsx`, `src/StepIcon.tsx`, `src/Rail.tsx`, `src/Context.ts` |
| react-component/switch | MIT | dd99fb19dfd14eb97cb20839b3592ca0ed419500 | `switch` | `src/index.tsx` |
| react-component/progress | MIT | 8efdfd5b5fda84c5030f284c2c1ec2da0a1dd25e | `progress` | `src/Line.tsx`, `src/Circle/*`, `src/common.ts` |
| vercel/commerce | MIT | f7521d57d29f0eb3d23c1399cf9bb299d61fcd21 | `variant_selector`, one more app case | `components/product/*`, `components/price.tsx`, `components/cart/*`, `components/layout/search/filter/*` |

Components are taken as they appear in the source. The pick follows what each library or app ships as its main component, not any compiler feature.

## Notes

- Sources were shallow-cloned into `nodes/corpus-heldout-3/src/` (not committed). The clone heads match the commits above.
- react-tabs dropped before building: its Tabs walk children with `Children` and `cloneElement` by element type, and the harness maps `Children` to Preact core, which has no such export. Keeping it would need a rewrite, not a near-verbatim copy.
- react-calendar: YearView (Months, Month, TileGroup, Tile, Flex) instead of MonthView. Same Tile and TileGroup, fewer date helpers to stand in for.
- vercel/commerce: two cases, `product_page` (ProductDescription, VariantSelector, AddToCart, Price, cart context) and `search_filter` (FilterList, FilterItemDropdown, FilterItem).
- Render counters must use the keys `Child`, `Row` or `Btn` (`RENDER_KEYS` in `benchmarks/compare/src/types.ts`). Any other key counts as a recompute.
- First harness run of `clock`: React Compiler reports a CompileError, "Expected object property value to be an LVal, got: AssignmentPattern", on every component whose parameter destructuring has defaults (Clock, Hand, Mark, MarkNumber). Only the new harness entry compiles. This is upstream code as written, so it stays.
- `.tsx` siblings fail every cell: `lowerJsx` passes `isTSX` and `allExtensions`, which Babel 8's preset-typescript rejects. `rate` was first written in TypeScript and was converted to `.jsx` and `.js`. The harness was not changed.
- React Compiler also errors on computed object keys (`` [`${prefixCls}-x`]: on ``, `[name.toLowerCase()]`) under Babel 8. heldout2 `list_group` shows the same default-destructuring error on BaseNav and ListGroup.
- product_page: dropped a scenario that submitted the cart form with no variant chosen; upstream disables the submit button then, so it could not happen. Option clicks follow available variants only.
- HTML differences between React and Preact found by the new test: `suppressHydrationWarning` attribute (Preact), `0px` vs `0` in style. Normalized in the test, not in the cases.
- Siblings, scenarios and meta formatted with oxfmt before hashing. Inputs are ignored by oxfmt.
- Totals (plain React / plain Preact / React Compiler): 650 / 650 / 561, 0 differences. Script: `scratch/totals.ts`.
