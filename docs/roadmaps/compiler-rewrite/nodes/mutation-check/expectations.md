# Expectations: mutation-check (written before reading the change)

Sources read: the brief, debate-2 "Settled structure" item 3 and the candidate families, the census outcome, and `benchmarks/compare/src/`.

## What a trustworthy check must do

1. **Oracle is plain on the mutant.** Each mutant is compared with the uncompiled run of the same mutant, on the same target. It is not compared with the original's output. The original's plain output is used only to decide if the mutant is inert.
2. **Same run path as the gate.** Mutants go through `compileCase`, `writeModule`, `runScenarios` and `findDifferences`, or code that is provably the same. A second renderer or a second comparison would test something other than what the gate tests.
3. **Fresh module per mutant.** The loader is a Vite SSR server with `watch: null`, so it caches modules by path. `writeModule` writes to `.out/<compiler>/<target>/<set>/<name>/input.js`. If every mutant of a case is written to that path in one loader session, each one after the first loads the stale module. Every mutant would then match plain and pass. Each mutant needs its own folder, or the module graph must be invalidated between mutants.
4. **Mutant sources are injected the way the harness reads them.** The compilers read `CorpusCase.source` and `siblings[].source`, not files. A mutant must replace those strings, including a mutated sibling for multi-file cases. Writing a file the harness never reads mutates nothing.
5. **Deterministic.** Two runs give the same mutant list (stable ids per operator, file and site) and the same verdicts. A changing global or clock is a counter the operator controls. It is reset before each scenario of each cell, so plain and next start from the same value. `Date.now()` is not a real clock, or plain against plain differs.
6. **Inert detection per target, with useful visibility.** A mutant is live only when its plain output differs from the original's plain output on that target. It should differ on at least one update step, not only on `(mount)`. A hazard that shows only at mount cannot catch a stale cache, because a cache can only go stale on an update. The report should give the steps where each live mutant differs.
7. **Hazard reaches the HTML.** `findDifferences` compares only `html` and `error`, never the counters. An operator whose hazard changes only counts, a ref, or a side effect that is never rendered cannot fail. Each operator must put the changing value into the DOM.
8. **Fails closed.**
   - Exit 1 on any difference for next, React or Preact.
   - Exit non-zero, or fail loudly, when plain fails to load on a mutant. `findDifferences(cell, plain)` iterates `plain.steps`, and a plain cell that failed has none, so it reports 0 differences: a false pass.
   - A mutant that throws in plain at mount stops its scenario, so its later steps never run. It is "broken", not live and not passing.
   - Zero mutants generated, or an operator with zero live mutants, is reported and should not read as green.
9. **Coverage report.** Mutants per operator and per file: generated, inert, broken, live, passed, failed. Ideally also whether next compiled the mutated unit or bailed out. A bailout passes legitimately, but a check where next bails out on every live mutant says nothing about the planner.
10. **Scope.** Sets are `base`, `tuning`, `heldout`, `heldout2` only. `heldout3` is never listed, globbed or read. Mutants are generated at run time and not committed.
11. **Operators match the brief** (all four groups). They are applied by AST at every site that fits, not by a regex that fits few sites. The `memo` and non-`memo` variants of the O8 child both exist.

## How it gives false passes

- Stale module cache: the same output path per case, as in point 3.
- Mutated text that never reaches the compiler, as in point 4.
- Mutant in a component, branch or callback that no scenario renders. Inert detection should catch this. If inert mutants are dropped silently, though, an operator can look covered while 0 of its mutants are live.
- Visible only at mount, as in point 6. Every compiler matches plain at mount, so the mutant counts as live and passes without testing anything.
- Hazard not in the HTML, as in point 7.
- Plain failed, so 0 steps are compared, as in point 8.
- Exemptions too broad: the check skips sites next is assumed to handle, such as `memo` children, imports or `forwardRef`. Or the generator leaves out the exact shapes the identity family (A) will relax: a conditional `displayName`, a write in a handler, `Object.assign`. Those are the mutants that matter most for the next family node.
- Global or counter not changing between the steps the scenario runs. For example it changes per module load and not per render, so plain and a cached next agree.
- Restricted compilers or targets: next only on React, or a Preact skip that the case's `meta.targets` does not justify.
- Errors truncated to 200 characters that happen to be equal in plain and next. This is rare and acceptable.

## How it gives false failures

- Nondeterminism: a real clock, `Math.random`, or a global counter not reset between cells. Plain runs first and leaves the counter at N, so next starts at N.
- Shared scenario data. `scenarios.js` is imported once through native `import` and kept in cache, and `resolveProps` makes only a shallow copy. A mutant that changes elements in `map`, `filter` or `find` (O12) changes the scenario's own prop objects during the plain run. Next then renders data that is already changed. Verdicts depend on cell order unless props are cloned deeply, or created fresh, for each cell.
- Mutating `Date.now` globally can change React's scheduler timing, which uses the clock. A local binding the operator injects is safer.
- Oracle artefacts. Plain and next differ for reasons other than the hazard, for example the 0.8 runtime rewrite, sibling relinking, or a key warning in the error text. Plain against plain on the original files should have 0 differences first.
- Mutants that are not valid for one compiler: parse errors, or TypeScript in `.tsx` files. They show as `load:` failures, which should be listed apart from real differences.

## What I will reproduce

1. Run `pnpm --filter compare mutate` twice. Compare the reports: the same mutant ids, the same counts per operator and file, the same verdicts, and the exit code.
2. Run `pnpm --filter compare typecheck`, `test` and `pnpm format:check`. Build before lint, as the memory note says.
3. Read the generator and the runner. Check the per-mutant output path or the cache invalidation, the source injection (input and siblings), the counter reset, the props cloning, the handling of a plain failure, and the exit code for zero live mutants.
4. List the mutants per operator. Read one generated mutant for each operator (in its out folder inside the worktree). Confirm the hazard is rendered and is reached on an update step.
5. Check the inert and broken classification on a sample. Pick a few inert mutants and say why they are inert. Flag any operator with 0 live mutants, or with live mutants that differ only at mount.
6. Sensitivity: show the check can fail. If the script accepts a compiler choice, run forgetti-0.8 (known unsound) and expect differences. Otherwise, write one hand mutant in a scratch folder inside the worktree where a cached render must go stale, and see it reported. Delete the scratch folder after.
7. Order and aliasing: check that verdicts for O12 mutants do not change when plain runs second or runs twice.
8. Grep the script for set names. Confirm `heldout3` cannot be selected.
9. Compare next's result at the batch head with `outcome.md`. Every difference is either fixed or recorded as a follow-up.
