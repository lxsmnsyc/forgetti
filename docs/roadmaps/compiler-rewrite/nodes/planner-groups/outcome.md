# Outcome: planner-groups

## Built

- `packages/forgetti/src/next/plan/groups.ts`: `runGroups`, the S2 planner. It replaces the baseline pass in `plan/index.ts`.
  - Candidates: a direct statement of the unit body, `return <expr>` or `const x = <expr>` with one plain declarator, or an expression-bodied arrow whose body is JSX.
  - An element candidate is split into pieces: the elements in children, attribute values and `{<jsx />}`, never inside a conditional or callback. Each piece gets the set of render-level bindings it reads.
  - A piece whose input set equals its owner's joins the owner's block. A smaller set gets its own block. Sibling leaf pieces with one input set share one block with several outputs (one compare). An owner compares the outputs of its inner blocks, not their inputs. Blocks are pushed inner first, so `first` rises toward the owner.
  - A binding input is replaced by what it stands for. A binding that is a block output is its own input. A member of a group that is final before the block (`frozenAt <= at.start`) stands for `group.inputs`. Any other local must be plain, as in the baseline.
  - A group is used only if the code that builds it is pure: its `created` ranges, its mutation ranges, and the initializers and assignments of its members (this catches a hook result such as `useMemo`). No `this`, `await`, hook call, nameless callee, `.current`, `.random` or `.now`, no global outside `STABLE_GLOBALS`, no module binding that changes. Its `inputs` must be plain inputs (no ref, no assigned binding).
  - `const` candidates other than JSX: a fresh literal (object, array, function, class, `new`) needs a binding that no group mutates. Any other value (a call, a conditional) must also be read-only in every use. A value with no inputs is not cached.
- `packages/forgetti/src/next/plan/cost.ts`: `isCheap`. Literals, names, arithmetic, comparisons, `!`, logical and conditional operators, property reads and template strings of those are cheap and get no slot. Calls, `new`, JSX, and object, array and function literals are not. A cheap `const` stays in the code and is an input by value.
- `packages/forgetti/src/next/ir.ts`: `OwnershipResult.bailout` (phase-ir v4). `ownership/index.ts` no longer has `OwnershipReport`. `compile()` already read `ownership.bailout`, so `index.ts` is unchanged.
- Tests in `packages/forgetti/test/next/plan/groups/`: `groups.test.ts` (10), `cost.test.ts` (22), `refusals.test.ts` (the 14 baseline tests, moved).

## Gate numbers

`pnpm --filter compare gate --set base,tuning --only soundness,bailouts`

- Soundness: PASS on React and Preact, 0 differences.
- Compiled share: PASS, 44 of 45 for forgetti next, 42 of 43 for React Compiler.
- Total work on React: next 161, forgetti 0.8 88, React Compiler 162 (was 183 with the baseline). On Preact: next 141, forgetti 0.8 65 (was 161).
- Gzip: PASS, 11663 against React Compiler's 17944 (ratio 0.650). No file above 1.15 times React Compiler.
- The O12 case `tuning/alias_child` no longer appears in the per-file failures, so it re-renders no more than React Compiler (it was 4 against 3).
- The work lines still FAIL by design. `branches`, `loops` and the tree cache come later. The biggest gaps: `base/forloop`, `base/map`, `tuning/hook_nested`, `tuning/throw_row` (loops and branches), and `tuning/alias_*` where React Compiler caches `bump()` statements (a block caches an expression, not a statement).

## Units React Compiler compiles that next skips

- None. The only unit next skips is `base/bailout` (`mutates-props`), and React Compiler bails on it too (0 of 1).

## Deviations

- `packages/forgetti/src/next/plan/baseline.ts` (not owned): the pass is removed from the list in `plan/index.ts`, and its helpers (`createContext`, `isPureSyntax`, `isPlainInput`, `isStableOuter`, `isResultReadOnly`, `findInitializer`, `STABLE_GLOBALS` and others) are now exported and reused. `runBaseline` stays in the file, unused. Every baseline refusal is kept through these helpers: computed keys checked against impure members, callees with no fixed name, hook calls through string keys, same-module functions that read changing state, and globals outside `STABLE_GLOBALS`.
- `packages/forgetti/src/next/emit/index.ts` (not owned): `wrapJsxRead` wraps a slot read in braces when the replaced output is a JSX child or an attribute value. Without it, a nested element output became JSX text. One function, no other change.
- `packages/forgetti/test/next/api.test.ts` (not owned): the pass-list test expects `groups, branches, loops`.
- `test/next/plan/baseline/baseline.test.ts` moved to `test/next/plan/groups/refusals.test.ts`. One test changed on purpose: a local that is pushed to and then read now gets a block keyed on `a` and `b`, not on the local.
- `ownership/index.ts` and `test/next/ownership/ownership.test.ts` (shared): `OwnershipReport` renamed to `OwnershipResult`.

## Stubs left

- `branches` and `loops` are still stubs. Nothing is cached inside conditionals, loops or callbacks.

## Gotchas

- A block caches an expression value. Statements (`bump('build')`, a loop that fills a group) always run. Reading a frozen group is keyed on its inputs, but building it is not skipped.
- Blocks sit before the statement of the candidate. Pieces inside one candidate are hoisted before the rest of that statement. Only pure pieces (checked by `isPureSyntax`) are hoisted.
- Group substitution trusts `group.inputs`. Module-level reads are checked by the planner over the group's code, not by ownership.
- An imported or prop function is assumed pure (same as the baseline). A call result that is a fresh value which a later call mutates is not tracked (ownership's known gap).
- Static sibling elements (no inputs) get one `EMPTY`-guarded block each, or share one when siblings.
- Cross-statement sharing of one input set is not done. Two `const` candidates on the same inputs have two compares.
- Output locals of a shared block are `_t<id>`, `__t<id>`.

## Proposed learnings

- A planner that cuts a value out of its statement must check that emit can rewrite the output in that syntactic position (JSX child, attribute) | emit replaces ranges by text | packages/forgetti/src/next/plan | no

## Verification

- `pnpm --filter forgetti test`: 18 files, 414 tests, pass.
- `rtk proxy pnpm lint`: no errors (warnings only). `pnpm format:check`, `pnpm typecheck`, `pnpm --filter compare test` (11 tests): pass.
- Gate: see Gate numbers.

## Size

- Estimated M, actual M (about 520 lines in `groups.ts` and `cost.ts`, about 270 lines of test).
