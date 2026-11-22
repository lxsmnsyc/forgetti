# Outcome: emit

## Built

- `packages/forgetti/src/next/emit/index.ts`: `emit(input, options): EmitResult`.
  - `EmitInput`: `{ code, program, bindings: { id, name }[], plans: CachePlan[] }`. `program` is the oxc-parser `Program` of `code`.
  - `EmitOptions`: `{ useRef: ImportDefinition, runtime?: string, filename?: string, sourceMap?: boolean }`. `runtime` defaults to `forgetti/runtime`.
  - `EmitResult`: `{ code, map }`. `map` comes from magic-string `generateMap({ hires: true, includeContent: true })` when `sourceMap` is set, else `null`.
- `packages/forgetti/src/next/emit/ast.ts`: a parent map and name set over the ESTree (`indexProgram`), plus `findInnermost`, `findExact` and `findFunction` by range.
- Emitted shapes:
  - Root: `const $ = useCache(useRef, N);` at the top of the unit's body. An arrow with an expression body becomes a block that returns the expression.
  - Value block, one output: `if (!Object.is($[0], a)) { $[1] = <value>; $[0] = a; }`, and the output range becomes `$[1]`. No inputs: `if ($[1] === EMPTY) { ... }`.
  - Value block, several outputs: `{ const t0 = <v0>, t1 = <v1>; $[1] = t0; $[2] = t1; $[0] = a; }`. All values are computed before any slot is written.
  - Keep block: `keep($, 1, <array>);` before the statement, and the output range becomes `$[1]`.
  - Branch node: `const $1 = branch($, i, N);` at the start of its arm. Conditional and logical arms are lowered to `if` statements. `return c ? a : b` becomes `if (c) { ...; return a; } else { ...; return b; }`. Other positions get `let $v; if (c) { ...; $v = a; } else { ...; $v = b; }` before the statement. `&&`, `||` and `??` keep the left value in `$v`. `if` blocks, lone `if` statements and `switch` cases take the header inside.
  - Iteration node, callback: `const $1r = branch($, i, 0), $1 = branch($1r, index, N);` at the start of the callback body. The index is the second parameter, or `indexLocal` added as one.
  - Iteration node, loop: `let i = -1;` before the loop and `branch($1r, ++i, N)` at the start of its body.
  - Imports: `import { useCache, branch, keep, EMPTY } from 'forgetti/runtime';` with only the helpers used, then `import { useRef } from 'react'` unless the module imports `useRef` from the preset's source already. They go after a directive prologue or hashbang. A helper name the module already uses gets a number suffix (`useCache as useCache1`).
- Emit refuses, with an `Error`, a block whose code would leave a nested function, sit in a loop test or update, or read an unknown input.
- Tests in `packages/forgetti/test/next/emit/`: `t2.test.ts` (fixtures against proof T2), `shapes.test.ts` (hand-built plans), `retry.test.ts` (throw and retry), `harness.ts` (writes emitted modules to `.out/` and renders them with React 19.3.1 under happy-dom).

## Acceptance

- Pass. `ternary` and `derived` render like proof T2's hand output in its scenarios (`same`, `inactive_b`, `active_a`, plus `flip` for ternary; `same`, `one_b`, `one_a` for derived): same HTML as uncompiled, same render and recompute counts as hand. Raw bytes with the `forgetti/runtime` specifier: ternary 495 vs 468 (1.06), derived 537 vs 511 (1.05). `map` is also checked: 605 vs 715.
- Pass. Hand-built plans emit `branch()` and `keep()` and run against uncompiled output with less work: `&&` branch, `if` block branch, `switch` cases (one with no inputs, so `EMPTY`), `for...of` iteration with `keep`, a branch inside a `.map` callback, and an arrow component with an expression body.
- Pass. Throw and retry matches uncompiled output for a call slot, a grouped slot (one compare, two values) and a per-row cache. Each case also runs a copy of the output with the inputs written first. That copy renders a stale value where uncompiled output shows the error, so each test can fail.
- Pass. Fast check.

## Deviations

- Outputs are read from their value slots (`$[1]`) instead of `let` locals. With locals, ternary was 571 bytes (1.22) and derived 631 (1.23), over the 10% criterion. `Output.local` is used only as a temporary in multi-output blocks. The write order is unchanged: value computed, then stored, then inputs stored. Filed as `contracts/phase-ir.change-request.md` (open).
- A branch block whose `at` is a whole statement arm (an `if` block or a `switch` case) goes before the arm's statement that holds the output, not at the arm's start. Its inputs may be declared earlier in the arm.
- `packages/forgetti/test/next/emit/harness.ts` adds `/// <reference lib="dom" />`, because the package `tsconfig.json` has no DOM types.
- No file outside the owned paths and `nodes/emit/` changed, except the change request in `contracts/`. The harness needed no change: `useCache(useRef, N)`, `branch($, 0, 0)` and `branch($1r, ++i, 2)` match `SLOT_PATTERNS.next`.

## Stubs left

- `compile()` in `packages/forgetti/src/next/index.ts` still returns the input. The node that wires the phases calls `emit()` with the scope result's `program` and `bindings`, the plans, and the preset's `runtime.useRef`.
- Source maps cover the original text that stays in place. Text moved into a block (the cached expression) is new magic-string content and has no mapping.

## Gotchas

- Hoisting changes evaluation order inside one statement. A block's code and a lowered conditional run before the whole statement. In `f(g(), c ? a : b)`, the conditional now runs before `g()`. The planner should put `at` on a statement where that order does not matter, or not cache there.
- `at` must name a statement in the node's own region. Emit throws for code that would cross a function boundary, and for code in a `for` test or update or a `while` test.
- A variable declaration with several declarators gets the code before the whole declaration. A block in `let a = f(), b = g(a)` that reads `a` would run before `a` exists. The planner must not do that.
- The iteration index is taken as given. An `indexLocal` that shadows a name the callback body reads changes behavior. Pick a fresh name.
- A loop iteration node always uses its own counter. It never reuses the loop's index variable.
- `switch` case headers are `const` declarations in the switch scope (`case 'a': const $1 = ...`). That parses and runs, but would trip `no-case-declarations` in linted output.
- Optional chaining (`a?.b(f(x))`) and default parameters are not treated as conditional. A block placed inside them is hoisted out unconditionally.
- Tests write `.jsx` files to `test/next/emit/.out/`, which `test/next/emit/.gitignore` ignores. Each test file removes its own folder.

## Proposed learnings

- Read a cached value from its slot instead of a `let` local | saves about 20 bytes per block with the same write order | packages/forgetti/src/next/emit | yes
- Slice a range with magic-string before overwriting it | `overwrite` drops content inserted inside the range, `slice` keeps it | packages/forgetti/src/next/emit | yes

## Verification

- `pnpm --filter forgetti test test/next/emit`: 3 files, 42 tests pass.
- `pnpm --filter forgetti test`: 8 files, 109 tests pass.
- `pnpm build`, then `pnpm lint`: exit 0. No finding in `src/next/emit/` or `test/next/emit/`.
- `pnpm --filter forgetti typecheck`: pass. `pnpm format:check`: pass.

## Size

- Estimated L, actual L. 900 lines of source and 1,020 of tests.
