---
id: eligibility-store-gaps
title: "Eligibility: rare store and alias forms left open by eligibility-writes"
status: todo
priority: should
type: fix
milestone: sound-baseline
size: S
added: 2026-11-24
verify: pnpm --filter forgetti test test/next/eligibility
owns:
  - packages/forgetti/src/next/eligibility/**
  - packages/forgetti/test/next/eligibility/**
depends_on:
  - on: eligibility-writes
    kind: hard
    why: extends the findDerived classifier that eligibility-writes built
---

# Eligibility: rare store and alias forms left open by eligibility-writes

## Goal

Close the soundness gaps that `eligibility-writes` lists under "remaining gaps" in its outcome. Its fresh review rated each one rare in real component code, so they did not block that node. Soundness is still the hard gate: each form must match uncompiled output or bail.

## Context

- Stores made by a callee: `fill(o, p); o.x.n = 1`. Rated low to moderate (helpers like `assign(o, p)`). A cheap rule: an unknown call that receives a local and a watched argument makes the local watched.
- Aliasing a local before a store: `const a = o; a.x = p.box; o.x.n = 1`.
- Store targets that are not a name: `getList().push(p.box)`, `(g[k] ||= []).push(p.box)` followed by a write below.
- False bailout to remove if cheap: clone, then mutate the clone. `const n = list.map(i => ({ ...i })); const it = n.find(i => i.id === id); it.done = true;` bails as `mutates-state` because a `map` callback that mentions state is treated as watched. A callback that returns a fresh literal should yield a copy.
- An imported or passed-in helper that returns a captured prop with no watched argument. Needs hidden module state; prove it can happen before changing code.

## Acceptance

- [ ] A failing test on the base for each form that reproduces, then a bail on the branch, with an allowed twin next to it.
- [ ] Forms that do not reproduce or cannot be closed cheaply are recorded in the outcome.
- [ ] The 15 base and 20 tuning corpus files keep their eligibility result.
- [ ] `pnpm --filter forgetti test` and typecheck pass.
- From the `fix-rc-callbacks` review: a global read through an alias (`const g = globalThis; () => a + g.__g`) is not seen as a global read, so a closure passed to a child goes stale when `g.__g` changes. It was already so before that node. Treat a binding initialized to `globalThis`, `window` or `self` as a global.
