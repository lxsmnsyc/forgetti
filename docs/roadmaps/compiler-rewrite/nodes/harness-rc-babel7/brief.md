---
id: harness-rc-babel7
title: Run React Compiler under Babel 7 in the compare harness
status: done
priority: must
type: fix
milestone: planner
size: S
added: 2026-11-23
spent: 252500
verify: pnpm --filter compare test
owns:
  - benchmarks/compare/src/compilers.ts
  - benchmarks/compare/package.json
  - benchmarks/compare/test/**
  - benchmarks/compare/results/rc-babel7/**
  - pnpm-lock.yaml
depends_on:
  - on: corpus-heldout-3
    kind: hard
    why: same test folder; heldout3 must be sealed before harness changes
---

# Run React Compiler under Babel 7 in the compare harness

## Goal

The harness runs `babel-plugin-react-compiler` 1.0.0 through `@babel/core` 8. React Compiler 1.0 is built for Babel 7, and under Babel 8 it fails on common syntax. Measured by the orchestrator on 2026-11-23 (one script, compile events per function):

- `({ a = 1, b }) => ...` gives `CompileError: (BuildHIR::lowerAssignment) Expected object property value to be an LVal, got: AssignmentPattern` under Babel 8.1.3 and `CompileSuccess` under Babel 7.29.13.
- Functions compiled under Babel 8 against Babel 7: `base` 14 and 14, `tuning` 54 and 54, `heldout` 19 and 24, `heldout2` 49 and 67.
- A computed template-literal key fails on both versions, so that one is a React Compiler limit.

So every gate so far measured a weakened React Compiler on `heldout` and `heldout2`. Run React Compiler through Babel 7, and fix TypeScript siblings, which fail to load because `lowerJsx` passes `isTSX` and `allExtensions` to `@babel/preset-typescript` 8, which rejects them (reported by `corpus-heldout-3`).

## Acceptance

- [ ] The `react-compiler` cell compiles with `@babel/core` 7 (a pinned devDependency alias such as `@babel/core-7`). The other cells are unchanged.
- [ ] A test proves a default in object destructuring compiles under React Compiler.
- [ ] A `.ts` or `.tsx` sibling loads in a multi-file fixture case.
- [ ] `results/rc-babel7/` holds the gate table and checks for `base`, `tuning`, `heldout`, `heldout2` with the fixed React Compiler, beside the `regate` numbers: React work, compiled share and gzip, all sets and `heldout2` alone. Reported only; the planner is not judged here.
- [ ] next and forgetti 0.8 numbers are unchanged from `results/regate/checks.txt`.

## Notes for the worker

- Never open `benchmarks/corpus/heldout3/` and never run any compiler on it.
- Do not change compiler code in `packages/`.
- Run gate scripts with `benchmarks/compare` as the working directory (`pnpm --filter compare ...`).
