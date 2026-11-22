---
id: eligibility-writes
title: Eligibility: writes to hook results, kept state instances, prop spread copies
status: active
priority: must
type: fix
milestone: sound-baseline
size: M
added: 2026-11-22
verify: pnpm --filter forgetti test test/next/eligibility
owns:
  - packages/forgetti/src/next/eligibility/**
  - packages/forgetti/test/next/eligibility/**
depends_on:
  - on: eligibility
    kind: hard
    why: extends the checker that eligibility built
---

# Eligibility: writes to hook results, kept state instances, prop spread copies

## Goal

Close three gaps in phase 2 found after `eligibility` landed (see `nodes/eligibility/outcome.md` "Gotchas" and `nodes/ownership/outcome.md`). Soundness is a hard gate: every case must match uncompiled output or bail.

## Context

Background from the maintainer discussion on 2026-11-22. Without a compiler, React only lets an object outlive one render when something holds on to it: `useRef`, `useState`/`useReducer`, `useMemo`/`useCallback`, context, an external store or a module variable. A literal in the render body is a new value every render. Caching such a literal is safe only when no one can tell. Values that come from a holder are outside inputs, compared by identity.

1. **Writes to hook results (caller side).** Only `useState` values are watched today. Treat every hook result like props: a write, update, delete or mutating method call on it, during render or inside a nested function, bails with `mutates-hook-result` if the contract has it, otherwise `mutates-state`. Writes to `.current` stay allowed (the ref convention, so custom hooks such as `useLatest` keep working). React Compiler does the same, except that it finds refs by the `*Ref` name rule. This check is per unit, so it needs no cross-file analysis.
2. **Instances kept in state.** `const [store] = useState(() => new Store())`, then `store.add(x)` in a handler, is a common way to keep one instance. The user clearly means to keep it, but the nested-write rule from `eligibility` may bail on it. First prove whether it bails today (write the test). If it does, decide with evidence:
   - Allowing it is sound only if no cached value reads the instance's changing fields as an input, because the identity stays the same while the contents change. That is a planner rule, so allowing it needs a `phase-ir` change request that marks such bindings opaque to the planner.
   - Otherwise keep bailing, and document it as a known false bailout in the outcome.
3. **Prop elements changed through a spread copy.** `const copy = [...items]; copy[0].x = 1` changes an element of a prop and does not bail. A spread copies one level only. Writes nested below a spread copy of props, state or a hook result bail as `mutates-props` (or the matching reason). A write to the copy itself (`copy[0] = y`, `copy.push(y)`) stays allowed.

## Acceptance

- [ ] A test for each case above, with an allowed twin next to it: a `.current` write on a hook result, a write to the copy itself, a read-only handler.
- [ ] Case 2 is either allowed with an accepted `phase-ir` change request, or recorded as a known false bailout, with the test showing which.
- [ ] The 15 base and 19 tuning corpus files keep their current eligibility result, except where a case above applies (list any that change).
- [ ] `pnpm --filter forgetti test` and typecheck pass.
