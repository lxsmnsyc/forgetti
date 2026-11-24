# Log: harness-multifile

- Rebased the branch on `batch/compiler-rewrite`. `pnpm install`, `pnpm build` first.
- Decision: siblings are the `.jsx`, `.tsx`, `.js`, `.ts` files in the case folder, top level only, except `input.*`, `scenarios.js`, `counter.js`. No sub-folders, because `relinkCounter` rewrites `../shared/counter.js` to `./counter.js` and that only fits one folder.
- Decision: gzip is one stream over input then siblings (sorted by name) joined by newlines. Raw, slots, ms, units, compiled are sums. Single-file cases return exactly what `compileSource` returned, so no number changes.
- Decision: a fixture is read with `readCase` and passed as `collect({ extraCases })`, so no corpus set changes.
- Added `.ts` handling in `runBabel` and `lowerJsx` (a `.ts` sibling would otherwise parse with the `jsx` plugin).
- `sumWork` throws only when the uncompiled cell failed (a failed baseline cell is still charged as uncompiled, as before).
- Dead end: none. First forgetti run failed 3 tests while `compare test` ran in parallel (timeouts, contention). Alone it passed 546.
- Gate run on 4 sets: `gate/checks.txt` equals `results/regate/checks.txt` (diff: identical), exit 1 as before.
