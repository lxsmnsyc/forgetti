# Log: fix-rc-callbacks

Base: `80da7a4` (batch/compiler-rewrite plus the node's set-active commit). Command `pnpm --filter compare table --set base --case <name>`, next on React, work is r plus c over the scenarios.

- `base/callback`: reproduced. next 3 (r1 on `same`, `one_other`, `one_id`), React Compiler 1. Cause: `isPureSyntax` rejected the arrow `() => { globalThis.__clicked = id }` because of the member assignment and the global, though render never runs the body.
- `base/jsxprops`: reproduced. next 6 against 1. Cause: the block compared `props`, a new object each render.
- `base/mutate`: reproduced. next 4 against 2. Cause: `arr.map(...)` over a frozen group sat inside the `div` block, so a changed `label` rebuilt every `Child`.
- `base/trycatch`: reproduced. next 4 against 2 (c1 on every step). Cause: the call in `out = risky(a)` inside `try` was never a candidate.

Fixes, in `plan/baseline.ts` and `plan/groups.ts`, plus the `member` input in `ir.ts` and `emit/index.ts`:

1. `walkEager` and `findDeferred`: a closure that is not a call argument is not walked for purity, and its globals do not count. Its captured bindings still are inputs.
2. `member` inputs for the props object.
3. A `.map(fn)` on a group member in a JSX child position is a piece, so it gets its own block on the group's inputs.
4. `try`, `catch` and `finally` statements `name = call(...)` are candidates when `name` is a local that is only assigned and read.

After: all four files equal React Compiler on React (1, 1, 2, 2), and on Preact 1, 1, 2, 2 against uncompiled 3, 6, 6, 4. Gate soundness 0 differences. Totals on `base` plus `tuning`: React 163 to 152, Preact 144 to 133. No file got worse (per-file table in the outcome).
