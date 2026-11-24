# Outcome: harness-multifile

## Built

The compare harness compiles sibling modules of a case with the compiler under test. Single-file cases give the same numbers as before.

Case folder layout (for `corpus-heldout-3`):

```
<set>/<case>/
  input.jsx | input.tsx   the entry module, exports the components the scenarios name
  meta.json               as before
  scenarios.js            as before (never compiled)
  button.jsx, util.js ... sibling modules (optional)
```

Rules:

- A sibling is any `.jsx`, `.tsx`, `.js` or `.ts` file directly in the case folder, except `input.jsx`, `input.tsx`, `scenarios.js` and `counter.js`. Sub-folders are not read. Use a flat folder.
- Two siblings that differ only in extension (`a.js` and `a.jsx`) throw, because both are written as `a.js`.
- Import siblings with a relative path that starts with `./`: `./button.jsx`, `./button` or `./button.js` all work. The harness writes every sibling as `<name>.js` next to `input.js`. An import written with the sibling's real extension (`.jsx`, `.tsx`, `.ts`) is rewritten to `.js` (`relinkSiblings`). Extensionless and `.js` imports resolve through Vite as they are.
- Siblings import the shared counter exactly like the input (`../shared/counter.js` or deeper `../../shared/counter.js`). Each file gets it relinked to the case's own `counter.js`, so the input and siblings count into one counter.
- Every sibling goes through `retarget` (Preact imports) and the same compiler as the input, per target. A sibling that does not compile makes the whole cell fail (`failure: compile: ...`).
- Scenarios still import components from the input module's exports (`mod[name]`). Components that live in siblings render as children of the input's components. Export from the input only what a scenario names.
- `scenarios.js` must not import a sibling. It loads the uncompiled source, so a sibling imported there would bypass the compiler under test. If a scenario needs something that lives in a sibling (a component, a context), the input must re-export it, and the scenario reads it from the module (`mod[name]`, `scenario.component`, `scenario.context.name`).
- A sibling named `input.*` (other than `input.jsx` and `input.tsx`) or `counter.*` throws, because the harness writes `input.js` and `counter.js` itself.

Numbers over several files (`compileCase` in `benchmarks/compare/src/compilers.ts`):

- `raw`, `slots`, `ms`, `units`, `compiled`: sums over the input and siblings.
- `gz`: gzip of the compiled input and then the compiled siblings by file name, joined with newlines, as one stream. Each file keeps its own runtime import line, as before (one import per file). Every file counts.
- `bailouts`: the input's, then each sibling's prefixed with `<file>: `.
- `CompileInfo.code` is the compiled input. `CompileInfo.siblings` holds `{ file, code }` of the compiled siblings (empty for a single-file case).

Other changes:

- `src/corpus.ts`: `readCase(set, name, dir)`, `readSiblings(dir)`. `CorpusCase.siblings`.
- `src/collect.ts`: `collect({ extraCases })` runs cases read from outside the corpus (fixtures). `readSet` is read first, then `extraCases`.
- `src/run.ts`: `writeModule` takes the `CompileInfo` and writes the siblings.
- `src/metrics.ts`: `sumWork` throws `The uncompiled cell failed to load, so work cannot be summed: ...` when the uncompiled cell failed, instead of recursing.
- `src/compilers.ts`: `.ts` files parse and lower as TypeScript without JSX.
- Test fixture: `benchmarks/compare/test/fixtures/multifile/pair/` (`input.jsx`, `panel.jsx`, `math.js`, `meta.json`, `scenarios.js`) and `benchmarks/compare/test/multifile.test.ts` (9 tests). The fixture is not in any corpus set, so the gate does not see it.

## Proof

Not a fix node.

## Result

Not an experiment node. The gate output with the new harness equals the old one:

- `pnpm --filter compare exec node results/regate/save.ts <out> base tuning heldout heldout2` (working directory `benchmarks/compare`) wrote `nodes/harness-multifile/gate/checks.txt`. `diff` against `benchmarks/compare/results/regate/checks.txt`: identical. Exit 1, the regate misses, as before.

## Deviations

- None. `test/gate.test.ts` got `siblings: []` in its `CompileInfo` literal (inside the owned `test/**`).

## Stubs left

- None.

## Gotchas

- The fixture's imports of `../shared/counter.js` do not resolve on disk. They are relinked before compiling, as in the corpus.
- A multi-file case adds its siblings to the gzip total of every compiler. A compiler that inlines nothing across files pays the runtime import once per file.
- The fast `pnpm --filter forgetti test` flakes with timeouts when run in parallel with `compare test`. Run them one after the other.

## Proposed learnings

- Run the forgetti and compare test suites one after the other | in parallel they time out on 8 cores | benchmarks/compare | no

## Verification

- `pnpm build`: pass.
- `pnpm --filter compare test`: 24 passed, 4 skipped (held-out tests need `--set`).
- `pnpm --filter compare typecheck`: pass.
- `pnpm --filter forgetti test`: 25 files, 546 tests pass (run alone).
- `rtk proxy pnpm lint`: 0 errors, 12 warnings, none in changed files.
- `pnpm format:check`: pass.
- Gate run: identical to `results/regate/checks.txt`.

## Size

- Estimated M, actual M.
