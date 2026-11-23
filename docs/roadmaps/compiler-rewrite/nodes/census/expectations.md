# Reviewer expectations for `census`

Written before seeing the branch. Sources: `brief.md`, `debate-2/debate.md`, `debate-2/evidence/T1-census.txt`.

## What a sound census must show

1. **Scope.** Development sets only: `base`, `tuning`, `heldout`, `heldout2`. No script, glob, set list or log mentions `heldout3` as an input. Both React and Preact are measured, and the report keeps them apart or says how it merges them.
2. **Coverage of instrumentation.** Refusals logged from `plan/groups.ts`, `plan/baseline.ts`, `plan/loops.ts`, `plan/branches.ts`, and whole-unit bailouts and skips (diagnostics). T1 left out `findCandidate` statement-shape exits, `findAssignedCall` and `findPropsId`; the report says whether those are now covered or still missing.
3. **Named failures.** Every refusal record carries file, unit, reason, and the binding or use that failed. Identity failures (a binding `isStableOuter` rejects) and purity failures (impure syntax, unstable globals, impure child body) are separate families, not one `outer_binding_unstable` bucket.
4. **A step-level denominator.** The unit of loss is a step (one scenario step, one target) where next's amendment-1 work equals plain's work on that step. The report gives the total of those steps per target and per set, and where it comes from (which harness run, which commit). File-level "next == plain" from `regate` is not enough.
5. **The join.** Each equal-to-plain step is attributed to refusals by unit and binding: the component whose child re-render or `costly()` recompute happened on that step, and the refusal that kept that value or element from being cached. Where the link is inferred (by unit name only, by line proximity, by "the only refusal in that unit"), the row is marked as a guess, and the report gives counts for exact and guessed joins separately.
6. **An unattributed bucket.** Equal-to-plain steps with no refusal joined are reported as their own line, not spread over families. Their size tells how much the instrumentation misses.
7. **Ranking and shares.** Families ranked by lost steps. Each family's share = its steps / total equal-to-plain steps, with the files it covers. If a step is joined to more than one family, the report says so and gives both a sole-cause count and an any-cause count; shares of the any-cause count may sum past 100% and the report must say that.
8. **Named files.** It says which families (if any) cover `heldout2/discussions_table` and `heldout2/toaster_store`, at step level, and how many of their excess steps each family explains.
9. **15% gate.** It states which families clear the debate's 15% rule (P18) and gives each one a predicted share a family node can be held to (P21).
10. **No compiler change.** The instrumentation is a patch file under `benchmarks/compare/results/census/`. `packages/` is unchanged on the branch. Compiled output with the patch applied equals compiled output without it, byte for byte, on all development files.

## How the join can go wrong

- **Sites counted as hits.** Counting refusal records (T1 style) and calling them lost steps. One refusal can cost zero steps (cheap expression, value that never changes) or many. Nested JSX logs a refusal per piece, so one tree inflates the site count. Check: lost-step totals must come from harness step data, not from record counts; a family with many sites and zero steps should exist (expected for `cheap_expression`, maybe for destructuring).
- **Counterfactuals that change soundness.** Estimating a family's share by forcing the planner to accept the refused case and counting the steps saved. If the forced output differs from uncompiled output on any step, the saved steps are not real savings: the refusal was correct there. Any counterfactual run must report its differences, and steps from a run with differences must be excluded or listed apart. A family whose only gain comes from unsound caching (impure child bodies, mutated call results, changing globals) is not a gain.
- **Steps whose output no longer matches uncompiled.** If baseline next already differs from plain on a step, that step is not a clean "next does the uncompiled work" step. Only steps where next's rendered output matches uncompiled may enter the denominator. The same holds for the React Compiler adjustment on its wrong steps.
- **Double counting across families.** One step lost because an element reads an unstable import and its props come from a mutated call result belongs to two families. Adding both to each family's share overstates both, and the 15% gate could pass for families that only win together. Also: the React and Preact compile records de-duplicated in T1, but steps must not be de-duplicated the same way, and the same step must not be counted twice across the two targets inside one target's total.
- **Upper bounds reported as exact.** "If this family were fixed, these steps would be saved" is an upper bound: fixing one refusal can expose the next one in the same unit (a cached element still re-renders a child whose props are uncached). The report must call these bounds, not predictions, unless a counterfactual run measured them. The debate's threshold says counts are exact; a census share is an estimate and must be labelled so.
- **Wrong attribution unit.** Joining a step to a refusal in a different unit (parent vs child) because the work is counted at the child render. The join must follow which unit failed to cache the element or value that caused the work.
- **Selective coverage.** Instrumenting only the families expected to win, so the unattributed bucket hides the rest.
- **Leakage.** Any glob that picks up all corpus folders, including `heldout3`.

## What I will reproduce

1. Check `git diff main...` (or the branch base) touches only `benchmarks/compare/results/census/**` and the node folder; `packages/` untouched.
2. Grep the census scripts and logs for `heldout3`; confirm set lists are explicit. I will not open or compile `heldout3`.
3. Apply the patch in a scratch copy or a temporary worktree, build, and compile the development files with and without it; confirm identical output.
4. Re-run the census script from a clean state and confirm the ranked table and totals match `census.md`.
5. Recompute the equal-to-plain step total from the harness results independently and compare with the report's denominator, per target.
6. Check that family steps plus unattributed steps reconcile with the total (sole-cause), and that overlap is reported.
7. Hand-check the join on `heldout2/discussions_table` and `heldout2/toaster_store`, plus two other random equal-to-plain steps: read the unit, find the refusal, and judge whether it is the cause of the work on that step.
8. Confirm every refusal record has a binding or use field, and that identity and purity are separate families.
9. Check any counterfactual run reports 0 differences, or that its steps are excluded.
10. Run the repo's lint, typecheck and tests to confirm nothing outside the patch changed.
