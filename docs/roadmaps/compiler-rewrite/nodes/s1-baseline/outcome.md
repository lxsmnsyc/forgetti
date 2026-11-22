# Outcome: s1-baseline

## Built

- `packages/forgetti/src/next/index.ts`: `compile()` now runs all five phases. It calls `parseAndScope`, `checkEligibility`, `analyzeOwnership` per eligible unit, `runPlanPasses`, then `emit` once for all plans.
  - A skipped unit: `compiled: false`, no diagnostic, no plan.
  - An ineligible unit, or an ownership `bailout` (`escaping-closure`): one `Diagnostic`, `compiled: false`, left as written.
  - Any other unit: `compiled: true`. A unit whose plan has no block is left as written.
  - With no plan at all, `code` is returned unchanged and `map` is `null`.
- `packages/forgetti/src/next/plan/baseline.ts`: `runBaseline`. It adds value blocks to the root node, one per candidate statement directly in the unit body.
  - Candidates: `return <jsx />`, `const x = <jsx />`, `const x = call(...)`, and an arrow component whose body is JSX.
  - Inputs: the render-level bindings the candidate reads, in source order. A call with no inputs is not cached.
  - A candidate is refused when it reads a binding that is written anywhere, listed as `opaque`, or a member of a group with mutations. The same for a binding declared after the statement, a ref or effect-event result, any `.current`, `.random` or `.now` member, a hook call, a mutator call (`push`, `sort`, `set`, `assign` and similar), `this`, `await`, `delete`, an assignment to a name declared outside the candidate, and a global outside a fixed list (`Math`, `Object`, `JSON`, ...).
  - Outer bindings are accepted only at module level, and only for imports, functions, classes and `const` with a literal or function initializer.
  - A call result is cached only if every use of its binding is a read (JSX, operators, member reads that are not calls).
- `packages/forgetti/src/next/plan/index.ts`: unchanged. The pass list already had `baseline`.
- `packages/forgetti/test/next/plan/baseline/baseline.test.ts`: 14 tests (cached element, call plus element chain, mutated local, reassigned local, call result passed on, ref and global reads, bailout, skip, and after review: string-key global, string-key hook, unnamed callee, module function reading a reassigned binding, fixed module function, imported function).
- Review fixes: a computed member or callee with a string-literal key is resolved to its name and checked like the plain form. A callee with no fixed name (`(0, f)(a)`, `a[k]()`) is refused, and so is `Math[k]` on a global. A same-module function (declaration, const arrow or function expression) is refused when it reads, directly or through other same-module functions, a binding that is assigned anywhere, a global outside the stable list (`Date`, `window`, ...), or a `random`, `now` or `current` member. A helper that reads only `Math.max` and its parameters is still cached.

## Acceptance

- Pass: 0 differences from uncompiled output on `base` and `tuning`, React and Preact (`pnpm --filter compare gate --set base,tuning --only soundness`: both soundness lines PASS; the other gate lines fail, as the planners that cut work come later).
- Pass: every unit is compiled or has a diagnostic, apart from `@forgetti skip` units. Compiled share on base plus tuning: 44 of 45 (React Compiler 42 of 43). The one left out is `bailout`, with a `mutates-props` diagnostic.
- Pass: fast check. `pnpm --filter forgetti test` 374 tests, `rtk proxy pnpm lint` 0 errors, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter compare test` (11 tests).
- Budget: about 780 lines written (507 in `baseline.ts`, 153 in `index.ts`, 121 of test), under half of the 9k estimate. Tokens spent by this node: about 130k, under half of the 600k debate estimate and of the 3.5M budget.

## Deviations

- `packages/forgetti/test/next/api.test.ts` (outside the owned paths): the three `compile stub` tests asserted the stub's unchanged output. They now assert the compiled output and `compiled: true`. The orchestrator accepted this edit.
- Gate numbers after this node on `base,tuning`: total work 183 on React (forgetti 0.8 has 88, React Compiler 162), gzip ratio to React Compiler 0.57. The work thresholds fail by design here.

## Assumptions

- A function imported from another module is pure: same arguments, same result, no read of changing state. A call to one is cached by its arguments. A test pins this.
- A candidate with no inputs (`<p>{t("hi")}</p>` with imported `t`) is cached once for the life of the component (`=== EMPTY`).
- Mutation of a module-level object through a member (`cache.x = 1`) is not tracked. Only assignments to a binding are.

## Stubs left

- The `groups`, `branches` and `loops` passes are still stubs. Nothing is cached inside conditionals, loops or callbacks, and a mutated group is never cached.

## Gotchas

- `runBaseline` needs the `ParseResult` (it reads `globals`). Called with a plain `ScopeResult`, it plans nothing.
- Emit throws on a bad plan and `compile()` does not catch it. A planner bug shows up as a thrown error, which the harness counts as a difference.
- Candidates are limited to direct children of the unit body so hoisting cannot reorder side effects. A later planner that goes deeper must pick `at` with that in mind (see the `emit` outcome).
- `findInitializer` walks the whole program for each query. It is fine at corpus sizes. Cache it if a module has thousands of bindings.
- Output locals are named `_t<block id>`, prefixed with `_` until no binding has the name. Only multi-output blocks use them.

## Proposed learnings

- None.

## Size

- Estimated M, actual M.

## Landed

- Commit `f9befc3` on `batch/compiler-rewrite`, squashed from the worker branch after two fresh review rounds and an orchestrator probe check of the round 2 fix.
