# harness-multifile: reviewer expectations

Written before seeing the change, from `GOAL.md`, the brief, and the base harness in `benchmarks/compare/src/`.

## Base facts the review relies on

- `corpus.ts` reads one `input.jsx` or `input.tsx` per case into `CorpusCase.source`. Nothing else in the folder is read except `meta.json` and `scenarios.js`.
- `collect.ts` runs `retarget(relinkCounter(source))`, then `compileSource`, then `writeModule`, then `runScenarios`. A compile throw and a load or run throw both become `Cell.failure`.
- `writeModule` writes `.out/<compiler>/<target>/<set>/<case>/input.js` plus a lowered `counter.js`. For `forgetti-0.8` it rewrites `forgetti/runtime` to `forgetti-0.8/runtime`.
- `loader.ts` is one Vite SSR server per `collect()` call. Its module cache is keyed by absolute path. Today compilers are isolated only because each writes to its own output folder.
- `scenarios.js` is loaded by native `import()` from the corpus folder, not through Vite and not compiled.
- `CompileInfo.gz` is `gzipSync(code).length` of the one compiled file. The runtime itself is never counted. Only the `import ... from 'forgetti/runtime'` (or `react/compiler-runtime`) line inside the file is counted.
- `units`, `compiled`, `bailouts` and `slots` come from one file.
- `sumWork(cell, plain)` calls `sumWork(plain, plain)` when `cell.failure` is set. When `plain` itself failed, it recurses until the stack overflows. `sumBaselineWork`, `reportFile` and `formatCellWork` all reach it.

## What a correct change must do

1. **Sibling discovery.** For each case, list sibling source modules in the case folder: `.js`, `.jsx`, `.ts`, `.tsx` files other than `input.*` and `scenarios.js`. `meta.json` and other non-code files are excluded. The order is deterministic (sorted). Nested subfolders are either supported or rejected with a clear error, not silently skipped. A case with no siblings produces exactly today's `CorpusCase`. The best design adds a field such as `siblings: { file, source }[]` that is empty for single-file cases.
2. **Same pipeline per sibling.** Each sibling goes through `relinkCounter`, then `retarget(…, target)`, then the same compiler with the same `target` preset and its own filename (for `.tsx` and TS parsing and for the bailout labels), then `lowerJsx`. For `forgetti-0.8` the runtime path rewrite applies to every file. For `react-compiler` the siblings compile only on React, because the cell is skipped on Preact. For `plain` the siblings are only lowered.
3. **Import resolution to compiled code.** Every sibling is written into the same `.out/<compiler>/<target>/<set>/<case>/` folder, so a relative import from the compiled input resolves to the compiled sibling of the same compiler and target. It must never resolve to the original file in `benchmarks/corpus/`. The written extension and the specifier must agree. The output is always `.js`, so the following specifier forms must all load:
   - `./helpers` (no extension; Vite may resolve it to `helpers.js`),
   - `./helpers.js`,
   - `./helpers.jsx` / `./helpers.tsx` / `./helpers.ts` (these must be rewritten to `.js`, or the file kept under a name the specifier finds),
   - `"./helpers"` with double quotes, and side-effect `import './x'`, `export … from './x'`, and dynamic `import('./x')` if the rewrite claims to cover them,
   - sibling to sibling imports (`a.jsx` imports `b.jsx`), not only input to sibling.
   Specifiers that must be left alone: `react`, `preact*`, `forgetti*`, and the counter, which `relinkCounter` already maps to `./counter.js`. An import of a missing sibling fails the cell with a load error. It does not crash the run and does not fall back to the source file.
4. **Module cache isolation.** Each compiler and target loads its own sibling files, so `next@react` never shares a module instance or counter with `plain@react`. Paths already differ per compiler, target, set and case, so isolation comes from writing siblings under the per-cell folder. The review checks that no sibling lands in a shared folder such as `.out/shared` or the corpus folder. A sibling and the input must import the same per-cell `counter.js` instance, so renders counted in a sibling component show up in the step counts.
5. **Gzip accounting.** The case's gz counts every compiled file. "One runtime import as before" means the runtime cost is not counted once per file in a way that penalises splitting. Either of these is acceptable if it is documented and applied the same way to every compiler: gzip of the concatenated compiled files, or the sum of per-file gzips with the runtime import counted once. `raw` and `slots` count every file too. The same method must apply to `react-compiler` and `next`, because the per-file 1.15 ratio compares them. For a single-file case the number must equal today's `gzipSync(code).length` exactly.
6. **Compiled share.** `units`, `compiled` and `bailouts` add up over all files of the case, for both `next` and `react-compiler`. React Compiler's events must be collected per file and summed. The shared `events` array is reset inside `compileOnce`, so a naive loop could drop earlier files' events. Timing (`ms`) may sum over files or keep the input only, as long as the choice is stated.
7. **`sumWork` failure.** When `plain` failed, `sumWork` throws an `Error` that names the problem, ideally with the case or cell and the failure text, instead of recursing. A failed compiled cell with a healthy `plain` is still charged as the uncompiled run, which is today's behaviour. The gate must keep reporting a `next` load failure as a soundness FAIL, not crash on it. I will check whether the change throws for any failed cell. If it does, a `next` load failure would crash `gate` instead of failing the check, and I would flag that as a behaviour change unless it is justified.
8. **Test fixture.** A two-file case lives under `benchmarks/compare/test/` (not under `benchmarks/corpus/`). A test runs it through `collect` (or the same internals) and asserts the following:
   - the compiled sibling is what loads, for example by checking that the `next` output file of the sibling contains the runtime import or slots, or that a memoised sibling component saves renders that `plain` does not,
   - this holds on React and Preact,
   - gz counts both files (larger than input alone),
   - units count components of both files,
   - `sumWork` throws on a failed plain cell, with a matching message.
   It must not depend on `CORPUS_DIR` set discovery unless the reader accepts a custom root. Corpus sets are unchanged (`git diff --stat benchmarks/corpus` is empty).
9. **No regression.** `pnpm --filter compare gate --set base --set tuning --set heldout --set heldout2` prints the same checks as `results/regate/checks.txt`. The `ms` timings are excluded from the comparison, because they vary by run, and the checks file has no ms. The compile table is the same apart from `ms`. No file outside the owned paths changes, compiler code included.

## Edge cases I will check

- Specifier forms in item 3, including extensionless and `.tsx` to `.js`.
- A sibling with no JSX (plain `.js` or `.ts` utility). It must still compile cleanly through every compiler, or be compiled and contribute 0 units.
- A `.tsx` sibling next to a `.jsx` input, and the other way round.
- A sibling that imports from `react`: Preact retargeting must apply to it, otherwise the Preact cell loads React.
- A sibling that imports the shared counter with `../../shared/counter.js`: `relinkCounter` must apply.
- A sibling that exports a Context or the component a scenario names. Scenarios look up exports only on the input module, so that is fine as long as the input re-exports what scenarios need. I will note whether this limit is documented.
- `scenarios.js` importing a sibling would load the uncompiled source through native import. This should be documented or blocked.
- A compile throw in a sibling: the cell fails with a message that names the sibling file, not the input.
- Stale files in `.out` from a previous run with different siblings. This is a minor issue. It is only a problem if a stale file could be imported.
- Single-file cases: byte-identical written `input.js`, same `CompileInfo` fields, same steps.

## Failure modes I expect to find

- Siblings copied raw (uncompiled) or loaded from the corpus folder, so `next` and `plain` share uncompiled helpers and the test still passes. The test must prove compilation, not only resolution.
- Extension mismatch: `./Child.jsx` written as `Child.js` but the specifier not rewritten, so the load fails or Vite resolves to the source.
- Siblings compiled with the React preset on Preact, or not retargeted.
- gz and units counted for the input only, or the runtime import counted once per file in one compiler but not the other.
- React Compiler events lost across files.
- `sumWork` changed to throw on any failed cell, which turns gate soundness FAILs into crashes. Or `sumBaselineWork` and `reportFile` still recurse through another path.
- Test fixture placed in `benchmarks/corpus/` or a new corpus set added.
- Changes outside owned paths, such as `types.ts` callers in other packages or compiler code. `types.ts` itself is inside `src/**`, so changes there are fine.
- The gate rerun is skipped or compared against fresh numbers instead of `results/regate/checks.txt`.
- ts-style violations (callback array methods, arrow-named helpers).
