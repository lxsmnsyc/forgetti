---
id: fix-control-deps
title: Key blocks on the tests that guard assignments they read
status: todo
priority: must
type: fix
milestone: tree-cache
size: M
added: 2026-11-22
verify: pnpm --filter forgetti test test/next/plan/control
owns:
  - packages/forgetti/test/next/plan/control/**
  - benchmarks/corpus/tuning/control_assign/**
shared:
  - packages/forgetti/src/next/plan/groups.ts
  - packages/forgetti/src/next/plan/branches.ts
depends_on:
  - on: tree-branches
    kind: hard
    why: the fix changes the block inputs that the branch pass builds on, in the same files
---

# Key blocks on the tests that guard assignments they read

## Goal

A block that reads a local assigned inside a conditional must also take that conditional's test inputs as its own inputs. Today it does not, so the block returns a stale value when only the test changes.

## Evidence

Found by the fresh review of `tree-branches`, reproduced by the orchestrator on `batch/compiler-rewrite` at `6e36370`, also present at `4dee990` (before `tree-branches`):

```jsx
import { B } from "x";
export function T({ k, b }) { let el = null; if (k) { el = <B v={b}/>; } return <div>{el}</div>; }
```

emits `if (!Object.is($[0], b)) { $[1] = <div>{el}</div>; $[0] = b; }`. When `k` goes from true to false and `b` stays the same, the cached `<div>` still shows `B`. The `switch (k) { case 1: el = <B v={b}/>; break; }` form has the same bug. The soundness gate passes because no corpus case has this shape. Without the import, `B` is an unknown global and the unit is not compiled, which hides the bug.

## Acceptance

- [ ] A test in `test/next/plan/control/` fails on the target before the fix and passes after, for each of: `if` without `else`, `if`/`else`, `switch` with and without `default`, `&&` and ternary assignment (`k && (el = <B/>)`), and a nested `if` whose outer test is the only changed input.
- [ ] A new tuning case `benchmarks/corpus/tuning/control_assign/` in the corpus format, with a scenario that flips the test while the other inputs stay the same. It shows a difference on the target before the fix and 0 after, React and Preact.
- [ ] 0 differences on `base` and `tuning`, React and Preact.
- [ ] Total work on React does not rise above React Compiler's (162 at `6e36370`). Record the before and after numbers.
- [ ] Fast check passes.

## Notes for the worker

- Prove the bug first with the failing test and the new corpus case, as the worker steps require.
- The inputs to add are the reads of every test on the path from the block back to each assignment of the local it reads: `if` and `switch` tests, `&&`, `||` and `??` left sides, and ternary tests. A test that is itself impure means the block cannot be cached; refuse it.
- Keep every existing refusal. The branch child caches themselves are correct; the bug is in the inputs of the block after the conditional.
- Do not open `benchmarks/corpus/heldout/`.
