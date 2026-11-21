# Proof T2: hand-written output under P4 and P5

Hand-compiled by the rules in the T2 question. Measured the same way as `evidence/compile.mjs`.

| File | Hand raw/gzip | Hand slots | React Compiler raw/gzip | forgetti 0.8 raw/gzip | Hand / React Compiler raw |
| --- | --- | --- | --- | --- | --- |
| ternary | 468/246 | 2+2+2 | 418/265 | 1807/563 | 1.12 |
| switch | 761/348 | 5+2+2+1 | 1036/404 | 2660/756 | 0.73 |
| map | 715/392 | 5, then 2 per row | 554/312 | 1395/508 | 1.29 |
| derived | 511/284 | 7 | 591/324 | 1636/554 | 0.86 |

- Runtime: 14 scenarios, HTML equal to uncompiled in all 14.
- Re-renders: hand output ties forgetti 0.8 on every row. It beats React Compiler on `derived/one_a`, `ternary/inactive_b`, `map/deep_item` and `map/append`.
- Empty slots need a sentinel. A bare `new Array(n)` reads an `undefined` input as a cache hit on the first render.
- The `map` result array needs an element-wise compare against the stored array. This loop is most of the 1.29 ratio.
- Caveat: four small files, compiled by hand. A real planner may emit more.
