---
id: fix-mutant-soundness
title: Fix the soundness holes found by the mutation check
status: todo
priority: must
type: fix
milestone: planner
size: M
added: 2026-11-23
verify: pnpm --filter forgetti test && pnpm --filter compare mutate
owns:
  - packages/forgetti/src/next/**
  - packages/forgetti/test/**
depends_on:
  - on: mutation-check
    kind: hard
    why: the failures to fix come from the check
---

# Fix the soundness holes found by the mutation check

## Goal

`pnpm --filter compare mutate` passes on next: 0 failing mutants on React and Preact. The failures are listed by cause in `nodes/mutation-check/outcome.md`:

- A: a call result changed after the call is still cached (`keep` returns the previous array, and the change lands in it).
- B: a `filter` callback that changes its element is treated as pure.
- C: a method call on a module object inside `.map` is treated as pure.
- D: a same-module child whose render is impure (reads a changing global, `Date.now()`, `ref.current`, writes its own `displayName`, or calls a closure from props) is skipped, because its element is cached or its props compare equal. debate-2 O8: a same-module child used as a tag needs a pure render body to be cached as an element; `memo` children stay exempt.

E (a child changing a prop) is out of contract by user ruling and is reported as allowed.

## Acceptance

- [ ] A failing unit test per cause in `packages/forgetti/test/` first, on the batch head.
- [ ] `pnpm --filter compare mutate` exits 0.
- [ ] 0 differences on the corpus, all four development sets, both targets.
- [ ] Work and gzip on the development sets are reported before and after (`gate --set base --set tuning --set heldout --set heldout2`). A rise is expected where the old output was unsound; list it per file.
- [ ] The fixes are general rules, not per-file patterns.

## Notes for the worker

- Never open `benchmarks/corpus/heldout3/`.
- `family-1` relaxes identity next (wrapper `displayName` writes at top level). Keep D's rule in one place so `family-1` can extend it: an unconditional top-level member write keeps a binding stable, a write inside a function body does not.
