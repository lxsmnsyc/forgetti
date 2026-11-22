# Outcome: tree-branches

## Built

- `packages/forgetti/src/next/plan/branches.ts`: `runBranches`, the S3 planner. It replaces the stub.
  - Sites: a conditional value (`?:`, `&&`, `||`, `??`), an `if` arm (including `else if` chains and lone statements) and a `switch` case. Each arm that holds a block gets a `branch` node with its own slots. An arm with no block adds no node, and its children go to the parent.
  - A conditional that is the whole candidate (`return c ? A : B`, `const x = c && A`, an arrow body) drops the root blocks the groups pass made for that statement and renumbers the root slots. This happens only when at least one arm got a node.
  - A conditional in a JSX child or attribute position of a kept element also gets arm nodes. It is planned only when the conditional is pure, reads plain inputs and uses stable globals, because emit hoists it before its statement.
  - Arm blocks come from `GroupPlanner`, so every groups refusal holds inside an arm: computed keys, nameless callees, hooks and `use()`, impure members, module helpers that read changing state, changing globals, mutated or reassigned locals. A hook call is never part of a block.
  - In arms, `name = <jsx />` statements are candidates (the `switch` fixture shape). Plain blocks inside an arm share the arm's cache.
  - Block ids are unique across the plan. Child slots come after the blocks of their node.
- `packages/forgetti/test/next/plan/branches/branches.test.ts`: 15 tests (arms, chains, `&&`, nested JSX, arrow body, early return keeps `useCache` first, refusals).

## Gate numbers

`pnpm --filter compare gate --set base,tuning`

- Soundness: PASS on React and Preact, 0 differences.
- Total work on React: next 159, forgetti 0.8 88, React Compiler 162 (was 161). Preact: next 139, forgetti 0.8 65 (was 141). The work lines still FAIL by design until loops and later nodes land.
- Proof T2 rows: `base/ternary/inactive_b` r0 and `base/switch/inactive_b` r0 on React and Preact (were r1). `ternary/active_a`, `switch/active_a` and `switch/kind_b` stay r1, as in the hand output. `base/ternary` and `base/switch` no longer appear in the per-file work failures.
- Gzip: PASS, 11906 against React Compiler's 17944 (ratio 0.664, was 0.650). No file above 1.15 times React Compiler. Raw sizes: ternary 495 (was 391), switch 775 (was 500), earlyreturn 765 (was 675).
- Compiled share: PASS 44 of 45, React Compiler 42 of 43.

## Deviations

- `packages/forgetti/src/next/plan/groups.ts` (not owned, planner-groups): exports `GroupPlanner`, `Candidate`, `CandidateKind`, `unwrap`, `classify` and `isGlobalStable`. `findCandidate` and `planCandidate` are public. New `take()`. `findCandidate(statement, allowAssign)` also returns `name = <jsx />` when `allowAssign` is set. The groups pass behaves as before.
- `packages/forgetti/src/next/plan/baseline.ts` (not owned): removed the unused `runBaseline`, `collectInputs`, `findCandidate` and the local `Candidate` type, as the review nit asked. Shared helpers stay.
- `packages/forgetti/src/next/plan/index.ts` needs no change: the `branches` entry already exists.

## Stubs left

- `loops` is still a stub. Nothing is cached inside loops or callbacks.

## Gotchas

- A static arm (no inputs) gets an `EMPTY`-guarded slot, as in proof T2. This costs a `branch` call per taken arm. `base/earlyreturn` grew from 675 to 765 raw bytes because of the `if (loading) return <p>loading</p>` arm.
- A nested conditional keeps its enclosing element block. Emit lowers the conditional before the statement, so arms run (as cache hits) on every render and the element block is keyed on all inputs. Only the arm values keep identity.
- A conditional in a JSX position is skipped when its test is impure or reads a mutated or reassigned local. This is conservative: a group member read there is not substituted.
- `const` declarations appear directly in a `switch` case. Names are unique (`$1`, `$2`), so this is valid.
- Block ids are renumbered when an arm node is attached. Tests should assert emitted text, not ids.
- Arms in loops, `try` and callbacks are not planned. The loops node owns iteration caches.

## Proposed learnings

- A planner that moves a conditional must check the test and arms against the code that runs before it in the same statement | emit hoists lowered conditionals before their statement | packages/forgetti/src/next/plan | no

## Verification

- `pnpm --filter forgetti test`: 19 files, 429 tests, pass.
- `rtk proxy pnpm lint`: exit 0 (warnings only). `pnpm typecheck`, `pnpm format:check` and `pnpm --filter compare test` (11 tests): pass.
- Gate: see Gate numbers.

## Size

- Estimated M, actual M (about 330 lines in `branches.ts`, 230 in tests).
