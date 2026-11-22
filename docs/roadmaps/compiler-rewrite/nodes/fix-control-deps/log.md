# Log: fix-control-deps

## Reproduction (before the fix)

- Target: `batch/compiler-rewrite` at `a035267`, no planner change.
- Added `packages/forgetti/test/next/plan/control/control.test.ts` and `benchmarks/corpus/tuning/control_assign/`.
- `pnpm --filter forgetti test test/next/plan/control`: 5 failed, 2 passed. Failing: `if` without else, `switch` without default, `&&`, ternary, nested `if`.
- The `if`/else and `switch` with default forms already key on the test. The else arm gives the group a second input that reads `k`, so they were not broken.
- `pnpm --filter compare gate --set base,tuning`: soundness FAIL on React and Preact: `tuning/control_assign: if_flip/test_off, switch_flip/test_off, and_flip/test_off`.
- Total work before the fix, with the new case in the set: React next 159, forgetti 0.8 91, React Compiler 165. Preact next 139, forgetti 0.8 68.
- Cause: the group a block reads (`el`) is keyed on `group.inputs`, which holds only the reads of the assigned value. The tests that guard the write are not inputs.

## Fix

- `plan/groups.ts`: `isFrozenGroup` now collects the tests that guard each write, mutation and creation of the group (`if`, ternary, `&&`/`||`/`??` left side, `switch` discriminant and case tests up to the case). `getBindingDeps` returns the group inputs plus the test reads.
- A test that is impure, reads a global that is not stable, or reads a value that is not a plain input makes the group not frozen, so no block reads it.

## Review round

- The fresh review found writes that a loop or an early exit can skip. The rule is now: refuse a group written inside a loop, or after a `break`, `continue` or `throw` in the same labeled statement, `try` block or `switch` case.
- Before the change, the 9 new refusal tests failed. After, `pnpm --filter forgetti test` passes with 448 tests.
- Gate after: React next 166, React Compiler 166, compiled share 48 of 49.
