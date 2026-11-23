---
id: corpus-heldout-3
title: Third held-out corpus, sealed from planner work
status: done
priority: must
type: feature
milestone: planner
size: L
added: 2026-11-23
spent: 481199
verify: pnpm --filter compare test --set heldout3
owns:
  - benchmarks/corpus/heldout3/**
depends_on:
  - on: harness-multifile
    kind: hard
    why: half the cases keep their library's file split
---

# Third held-out corpus, sealed from planner work

## Goal

Add 8 to 10 real-shaped cases in `benchmarks/corpus/heldout3/`, in the format of `benchmarks/corpus/heldout2/`, from MIT-licensed libraries and apps not used by any earlier set. At least half keep the library's file split: the component and the modules it imports (child components, hooks, stores) as siblings in the case folder.

## Acceptance

- [ ] 8 to 10 cases, each with scenarios that change props and state and count child re-renders and `costly()` recomputes.
- [ ] At least half are multi-file.
- [ ] `pnpm --filter compare test --set heldout3` runs them; plain runs skip them, as with `heldout2`.
- [ ] Plain and React Compiler run them with 0 differences.
- [ ] `outcome.md` lists each source (repo, commit, path, license) and a SHA-256 of every file in the set.

## Notes for the worker

- Pick the libraries and apps first, from code you have not seen in this repo, and write the list in `log.md` before you build any case.
- Do not read `debate-2/`, any planner node's `outcome.md` (`regate`, `fix-*`, `census`, `family-*`), `benchmarks/compare/results/`, or compiled output of any compiler. Do not read `packages/forgetti/src/`.
- Run the harness with `--compiler plain --compiler react-compiler` only. Nobody may see `next` or forgetti 0.8 output for `heldout3` before `gate-3`.
- See `nodes/corpus-heldout-2/outcome.md` for how the earlier set was built.
