# Log: fix-tree-view-size

- Base `3a75879`, `pnpm --filter compare table --set heldout --case tree_view`: next 2046 gzip, 6205 raw, 72 slots (React Compiler 1634, 15 slots). Work equals React Compiler on every step.
- Bytes: `Node` had 28 slots and `TreeView` 13, plus 4 arm caches. Most were blocks for host-only trees: the root `div` with 12 inputs (it re-lists the inputs of the conditional arms the branches pass moves out), `ul`, `section`, `h4`, `p`, buttons, `li > a`. They save no render and no call: React reconciles host nodes for free, and every component inside has its own block.
- Tried a rule with no input threshold: tree_view 1557, but 20 tests that assert a cached `<h1>{title}</h1>` failed. Tried it without the call check: `dashboard_card` work went 12 to 42 (calls in the dropped blocks ran every render). Both fixed: calls count as work, and only blocks with at least 4 inputs are dropped.
- Final: tree_view 1806 gzip (1.105), 46 slots. Work totals unchanged (React 374, Preact 355). Gzip total 37216 against React Compiler 47458 (0.784, before 38027).
- Soundness: gate 0 differences on React and Preact, base, tuning, heldout.
