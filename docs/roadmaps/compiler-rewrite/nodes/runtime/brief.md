---
id: runtime
title: Runtime: useCache, branch and keep
status: active
priority: must
type: feature
milestone: sound-baseline
size: M
verify: pnpm --filter forgetti test test/next/runtime
owns:
  - packages/forgetti/runtime/next.ts
  - packages/forgetti/test/next/runtime.test.ts
  - packages/forgetti/test/next/runtime/**
provides: [runtime-api]
depends_on:
  - on: contracts
    kind: contract
    via: runtime-api
---

# Runtime: useCache, branch and keep

## Goal

Implement and test the runtime in `contracts/runtime-api.md` for React 19.3 and Preact 11.2.

## Context

- Proof T1 (`debate/evidence/proof-t1/t.mjs`, `RESULT.md`) is the test plan. Port its cases to vitest with happy-dom.
- The hand output of proof T2 (`debate/evidence/proof-t2/hand/`, `rt.js`) shows the call shapes the emitter will produce.

## Acceptance

- [ ] Every T1 case matches uncompiled output on React and Preact with hand-written slot code that follows the write rule.
- [ ] A test shows the inputs-first write order fails on throw and retry, so the rule stays documented in a test.
- [ ] `keep` returns the stored array for equal elements, including `NaN`, and stores the new one otherwise.
- [ ] Minified runtime size is printed by a test and is under 400 bytes.

## Sizing

M: small code, wide test matrix.
