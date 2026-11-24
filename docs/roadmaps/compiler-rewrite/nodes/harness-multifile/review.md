# harness-multifile: review

Branch `feat/harness-multifile` at `efb8674`. The diff is against `1430fd9`. The brief edits to `family-2` and `harness-multifile` in that range come from the orchestrator commits `2f8fc24` and `838400c`, not from the worker. The worker's commit only touches `benchmarks/compare/**` and its own node folder. I wrote expectations before reading the diff (`expectations.md`).

## Verdict

Clean. No blocking findings. One should-fix and four nits. None of them affects the current corpus or the gate.

## Checks run

- `pnpm --filter compare test`: 5 files passed, 2 skipped (held-out tests need `--set`). 24 tests passed, 4 skipped.
- `pnpm --filter compare typecheck`: pass.
- `diff nodes/harness-multifile/gate/checks.txt benchmarks/compare/results/regate/checks.txt`: identical.

## Against the expectations

- **Sibling discovery** (`corpus.ts` `readSiblings`): flat folder, sorted, `.js/.jsx/.ts/.tsx`. `input.jsx`, `input.tsx`, `scenarios.js` and `counter.js` are excluded. Subfolders are skipped, and the outcome documents this. Two files with the same name but different extensions throw. Met.
- **Same pipeline per sibling** (`compilers.ts` `compileCase`): each sibling goes through `relinkCounter`, then `retarget`, then `compileSource` with its own filename and the cell's target. `prepareCode` applies the forgetti-0.8 runtime rewrite and `relinkSiblings` to every file. Met.
- **Import resolution**: `./x.jsx`, `./x.tsx` and `./x.ts` are rewritten to `./x.js`. `./x` and `./x.js` resolve through Vite to the written `.js` in the cell folder. Sibling-to-sibling imports go through the same `prepareCode`. The rewrite matches any quoted `./<file>` literal, so `export from` and dynamic `import()` are covered too. Met.
- **Module cache isolation**: siblings are written into `.out/<compiler>/<target>/<set>/<case>/`, so each cell has its own paths and its own counter. The fixture's mount counts `{ double: 1, Child: 1 }` show that the sibling and the input share one counter. Met.
- **Compiled on React and Preact**: the test reads the written `panel.js` and requires `$$cache(`, `_c(` or `useCache(` for each compiler. It checks both targets where the compiler runs, and that `plain` has none of them. This proves compilation, not only resolution. Met.
- **Gzip**: gzip of one stream (input, then siblings by name, joined with `\n`), applied the same way to every compiler. A single-file case returns `compileSource`'s result unchanged. The runtime import stays in each file. Gzip back-references make the repeats nearly free, and the outcome states the choice. Met.
- **Compiled share**: `units`, `compiled` and `bailouts` add up over the files. React Compiler events are per `compileSource` call, so none are lost. The test asserts `compiled === 2` for every compiler. Met.
- **sumWork**: throws `The uncompiled cell failed to load, so work cannot be summed: ...` only when `plain.failure` is set. A failed compiled cell is still charged as the uncompiled run. A failed `next` cell still shows as a soundness FAIL rather than a crash. Met, with the behaviour I expected.
- **No corpus change, gate identical**: met.

## Findings

### 1. should-fix: a sibling can silently overwrite `counter.js` or `input.js`

- File: `benchmarks/compare/src/corpus.ts:50` (`RESERVED`), `:59` (`outputs`), and `benchmarks/compare/src/run.ts:136`.
- Failure scenario: a case folder holds `counter.jsx`, `counter.ts`, `input.js` or `input.ts`. `RESERVED` only lists the exact names `counter.js`, `input.jsx` and `input.tsx`, so these become siblings. They are written as `counter.js` or `input.js` in the cell folder:
  - `writeModule` writes the shared counter first, then the siblings. A `counter.jsx` sibling replaces the case's counter.
  - `input.js` is written last, so it replaces an `input.ts` sibling. The input's import of `./input.js` then points at itself.
  
  Neither case throws, so the numbers are wrong with no error. `corpus-heldout-3` is written by another agent from the outcome's rules, so this matters before that node runs.
- Evidence: `outputs` starts empty, so the collision check never sees the two names the harness itself writes. `readSiblings` maps any `.(jsx|tsx|js|ts)` to `.js`.
- Fix: seed `outputs` with `input.js` and `counter.js`, so these names throw like the `a.js`/`a.jsx` case. It is a one-line change.

### 2. nit: test uses callback array methods (ts-style)

- File: `benchmarks/compare/test/multifile.test.ts:37`, `:89`, `:104` (`.map`, `.find`).
- The ts-style rules call for for-of loops. These are test assertions only.

### 3. nit: sibling compile errors do not always name the file

- File: `benchmarks/compare/src/compilers.ts:251`.
- Failure scenario: the new compiler throws on a sibling. The cell failure reads `compile: <error>`. Babel errors include the filename, but an error thrown by `next`'s `compile()` may not, so the failure cannot be traced to the sibling.
- Fix: wrap the sibling `compileSource` call and prefix the error with `sibling.file`.

### 4. nit: the extension regex is repeated three times

- File: `benchmarks/compare/src/corpus.ts` (`MODULE_FILE`), `src/run.ts:136`, `src/compilers.ts:286`.
- One exported helper, for example one that returns the output name of a file, would keep the three places in step.

### 5. nit: `results/final-gate/time.ts` times only the input

- File: `benchmarks/compare/results/final-gate/time.ts:19` (outside the owned paths, so the worker left it).
- It calls `compileSource` on `testCase.source`. For a multi-file case it would time the input and skip the siblings. It is a historical script and no gate check uses it. If `gate-3` reuses it, it should call `compileCase` instead.

## Documented limits (accepted)

- `scenarios.js` is loaded from the corpus folder and never compiled. Scenarios look components up on the input's exports only. The outcome states both. It does not say that `scenarios.js` must not import a sibling, which would load the uncompiled source. Worth one line in `corpus-heldout-3`'s brief.
- Files left in `.out` from an earlier run with other siblings stay on disk. They are only reached if imported, so this is harmless.
