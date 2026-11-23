---
id: corpus-heldout-2
title: Second held-out corpus, unseen before the regate
status: done
priority: must
type: feature
milestone: tree-cache
size: M
added: 2026-11-24
spent: 376370
verify: pnpm --filter compare test --set heldout2
owns:
  - benchmarks/corpus/heldout2/**
depends_on:
  - on: final-gate
    kind: hard
    why: the first held-out set is exposed by the gate; this replaces it as the clean check
---

# Second held-out corpus, unseen before the regate

## Goal

Add at least 6 real-shaped components of 100 to 250 lines in `benchmarks/corpus/heldout2/`, in the same format as `benchmarks/corpus/heldout/`. Prefer shapes the first set lacks: forms with spread props, context consumers, lists with keyed children, effects with cleanup, memo children. Take near-verbatim code from MIT-licensed open-source React apps and record the source.

## Acceptance

- [ ] At least 6 cases, each with scenarios that change props and state and count child re-renders and `costly()` recomputes.
- [ ] `pnpm --filter compare test --set heldout2` runs them; plain runs skip them, as with `heldout`.
- [ ] Plain and React Compiler run them with 0 differences.

## Notes for the worker

- Do not run the new compiler (`next`) or forgetti 0.8 on these cases, and do not look at their output. Run the harness with `--compiler plain --compiler react-compiler` only. Nobody may see `next` output for `heldout2` before `regate`.
- See `nodes/corpus-heldout/outcome.md` for how the first set was built.
