---
date: 2026-11-24
amends: debate.md, section "Hypothesis"
status: approved
reason: final-gate missed (benchmarks/compare/results/final-gate.md)
---

# Amendment 1: measure against what users would otherwise run

The user asked the orchestrator to pick the bar that gives forgetti's users the most benefit. This amendment replaces the "Threshold" and "Kill" parts of the hypothesis in `debate.md`. The statement, metric and corpus stay.

## Why

- A React user's real alternative is React Compiler. It was sound on every corpus step at `final-gate`, so beating it file by file is a benefit the user can rely on.
- forgetti 0.8 renders wrong output on steps of 9 files (`base/forloop`, `tuning/alias_*`, `tuning/throw_*`, `base/bailout`, `heldout/otp_input`). Its lowest counts come from those steps, and no sound compiler can reach them. Its other wins come from caching nearly every expression, at 2 to 3 times the gzip size. Chasing them costs every user bundle size.
- On Preact there is no React Compiler. The alternatives are forgetti 0.8, which is unsound, or no compiler.
- `final-gate` showed the new compiler is sound, 0.771 times React Compiler's gzip, 1.6 to 2.8 times faster to compile, and below React Compiler in total work (461 against 500). It is above React Compiler on 7 files.

## Threshold (replaces the old one)

- 0 differences from uncompiled output on every file and both targets.
- React: total work strictly below React Compiler, and no file above React Compiler.
- Preact: total work strictly below uncompiled output, and no file above uncompiled output.
- Total gzip at most 1.0 times React Compiler, and no file above 1.15 times.
- Compiled share at least React Compiler's on the held-out files.
- The same rules hold on `heldout2`, a held-out set nobody has seen compiled output for before the gate runs.
- On steps where React Compiler itself differs from uncompiled output (for example `tuning/callback_globals`, where it caches a closure that reads a changing global), its count for that step is replaced by uncompiled output's count. A wrong step is not a bar a sound compiler must meet. Report each such step.
- forgetti 0.8 is reported on every row, with its wrong steps marked, but is not a threshold. Steps where it is sound and the new compiler does more work are listed as follow-up candidates.

## Kill (replaces the old one)

- A difference from uncompiled output that cannot be fixed without bailing out more components than React Compiler.
- Total gzip above 1.3 times React Compiler.
- The token budget in `GOAL.md` is the spend limit.

## Exposure

`heldout` was measured in full by `final-gate`, and the follow-up nodes look at its components. Its rows still count, but `heldout2` is the clean check.
