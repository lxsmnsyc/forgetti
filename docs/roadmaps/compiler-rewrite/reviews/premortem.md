# Premortem

It is some weeks from now and the rewrite failed or shipped late. The five most likely reasons:

1. **Ownership misses an alias pattern in real code, and `final-gate` shows a stale value on a held-out file.** The tuning set only holds the cases the debate named.
   - Plan change: `ownership` treats any pattern it does not recognize as a mutation site of every group it reaches, and `eligibility` reports it. `final-gate` turns any difference into a follow-up node, not a tuning pass.
2. **The bailout rate on held-out files is worse than React Compiler's, because the bailout triggers are too broad.**
   - Plan change: `planner-groups` already checks the rate on `base` and `tuning` with React Compiler's logger. Each skipped unit is listed with its reason, so the gap shows before `final-gate`.
3. **The budget runs out before S4.** The 9k-line estimate rests on one calibration repo (debate O3).
   - Plan change: `s1-baseline` reports lines and tokens against the budget. The roadmap stops for a new debate if S1 alone uses half of either.
4. **Preact 11 differs from React on Suspense or `use()` timing, and the runtime tests only ran on React.**
   - Plan change: `runtime` and `harness` run every case on both targets. `use()` on Preact goes through `preact/compat`, and the harness records which target a difference came from.
5. **`emit` output grows past React Compiler's size once real plans replace the hand-written fixtures.**
   - Plan change: `emit` acceptance compares bytes with the proof T2 hand output (within 10%). `tree-branches` and `tree-loops` run the size part of the gate on `base` before `final-gate`. Accept the rest as the hypothesis's kill criterion (above 1.3 times after S3).
