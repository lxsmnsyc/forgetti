# Outcome: fix-control-deps

## Built

- `packages/forgetti/src/next/plan/groups.ts`: a block that reads a frozen group now also takes the reads of the tests that guard the group's writes as inputs. New methods `findGuardIds`, `findGuards`, `addGuards`, `addTest` and a `guardIds` map.
  - Tests counted: `if` and ternary tests, the left side of `&&`, `||` and `??`, a `switch` discriminant and the case tests up to the case (fall-through).
  - A test that is impure, reads an unstable global or reads a value that is not a plain input makes the group not frozen, so no block reads it. This is the refusal the brief asks for.
  - A group is also not frozen when a write sits in any loop, or when an earlier `break`, `continue` or `throw` in the same labeled statement, `try` block or `switch` case can skip it. Method `canSkip`.
  - Existing refusals are unchanged. `branches.ts` needed no change.
- `packages/forgetti/test/next/plan/control/control.test.ts`: 19 tests. 7 for the guard forms (`if`, `if`/`else`, `switch` with and without `default`, `&&`, ternary, nested `if`), 9 refusals (loops, labeled `break` and `continue`, `break` in a case, `throw` in a `try`) and 3 that stay keyed (early return first, `else if`, `??=`).
- `benchmarks/corpus/tuning/control_assign/`: components `ControlIf`, `ControlSwitch`, `ControlAnd`, `ControlSkip` (a `continue` in a loop). Each flips the test with the same `b`.

## Proof

- base: `a035267`, `pnpm --filter forgetti test test/next/plan/control` gives 5 of the 7 original tests failed. `if`/else and `switch` with `default` were already correct, because the else arm adds `k` to the group inputs.
- base: the 9 refusal tests also fail on the first fix (9 failed, 10 passed) and pass after `canSkip`.
- base: `pnpm --filter compare gate --set base,tuning` fails soundness on React and Preact: `tuning/control_assign: if_flip/test_off, switch_flip/test_off, and_flip/test_off`.
- branch: the control tests pass (7 of 7). The gate reports soundness 0 differences on React and Preact.

## Total work

`pnpm --filter compare gate --set base,tuning`, with `control_assign` in the set.

- Before the fix, 3-component case: React next 159, forgetti 0.8 91, React Compiler 165. Preact next 139, forgetti 0.8 68. Compiled share 47 of 48, React Compiler 45 of 46.
- After the first fix, same case: React next 162, React Compiler 165. Preact next 142.
- After the loop and early-exit refusal, with the `ControlSkip` scenario added: React next 166, forgetti 0.8 92, React Compiler 166. Preact next 146, forgetti 0.8 69. Compiled share 48 of 49, React Compiler 46 of 47.
- `base/forloop` rose from 14 to 17 because a write in a loop is now refused. React is level with React Compiler (166), not above it. `tree-loops` is expected to win this back.
- Gzip PASS 12092 against 18555 (ratio 0.652). The work lines still FAIL by design.

## Deviations

- `packages/forgetti/src/next/plan/groups.ts` is a shared path. No other file outside the owned paths changed.
- The brief expects each of the listed forms to fail before the fix. `if`/else and `switch` with `default` did not fail, and their tests are kept as guards.

## Stubs left

- None.

## Gotchas

- The test reads are added to the group's inputs only inside `GroupPlanner`. `group.inputs` from the ownership phase is unchanged.
- Loop tests are not collected as guards. A group written in a loop is refused instead, until `tree-loops` adds loop caches.
- A test that reads another group member makes the group not frozen, because the member is not a plain input.

## Proposed learnings

- A block keyed on a group must also be keyed on the tests that decide whether the group is written | the ownership inputs hold value reads only | packages/forgetti/src/next/plan | yes

## Verification

- `pnpm --filter forgetti test`: 20 files, 448 tests, pass.
- `rtk proxy pnpm lint`: no errors. `pnpm typecheck`, `pnpm format:check`, `pnpm --filter compare test` (11 tests): pass.
- `pnpm --filter compare gate --set base,tuning`: soundness, gzip, file gzip and compiled share pass. Work lines fail as expected.

## Size

- Estimated M, actual S (about 90 lines in `groups.ts`, 60 in tests).
