# Outcome: tree-loops

## Built

- `packages/forgetti/src/next/plan/loops.ts`: `runLoops`, the S3 loop planner. It replaces the stub.
  - Sites: a loop statement (`for`, `for-in`, `for-of`, `while`, `do-while`, not `for await`) and a `.map(fn)` call with one function-expression argument. The walk covers the root, branch arms and iteration bodies, never closures, loop headers or deeper caches. It recurses into new iteration nodes, so a map in a map, a loop in a loop and a map in a ternary arm get nodes.
  - Each site gets an `iteration` node. Its blocks come from `GroupPlanner`, so every groups refusal holds in a row: hooks, impure members, nameless callees, changing globals, mutated or reassigned locals. Candidates in a body: `return`, `const`, `name = <jsx />` and an element handed to a call (`rows.push(<Row />)`). An expression callback body is one candidate. A node with no block and no child cache is dropped.
  - A `.map` call also gets a `keep` block (`at` is the call range, so emit lowers an enclosing arm and the call runs only when the arm does). A block that cached the call alone is replaced. A block that holds the call (`<ul>{xs.map(...)}</ul>`) drops the inputs only the call read and takes the keep output instead, so a new `xs` array with equal rows does not rebuild it. If the block reads a group member outside the call, its inputs stay.
  - A map is skipped when: it is inside an optional chain, the callback is not a function expression, it has a rest parameter or a destructured index parameter, or its receiver reads a non-plain input or impure code.
  - Slots are packed again after every change (`layoutNode`).
- `packages/forgetti/src/next/plan/baseline.ts` (not owned): `Context.perIteration` and one early return in `isPlainInput`. Names a `let` or `const` that a `for` header declares count as plain inputs inside the body, unless the body writes them. A `var` in a header is added to `ctx.unsafe` instead, since one binding serves every pass and closures of earlier passes see its last value (found in review).
- `packages/forgetti/test/next/plan/loops/loops.test.ts`: 17 tests.
- `benchmarks/corpus/tuning/loop_shapes/` (not owned): `LoopArm`, `LoopCallback`, `LoopNested`, `LoopAnd`, `LoopOf`, `LoopCounter`, `LoopSkip` with 34 scenarios, including two `var` loops whose closures read the counter. Covers the acceptance shapes and loop exits.

## Acceptance

- 0 differences on `base` and `tuning`, including `forloop`: pass (React and Preact).
- `map` one-item-replaced and append re-render 1 row: pass. `tuning/loop_shapes/arm_replace`, `arm_append`, `callback_append` and `and_replace` are r1 on React and Preact. Plain is r3 or r4, React Compiler r3 or r4.
- `.map` in a ternary arm and a ternary in a `.map` callback match uncompiled output: pass (`arm_*`, `callback_*`, `and_*` scenarios, 0 differences).
- Memory, 1,000 rows (heap after GC, mirroring the emitted calls with `useCache`, `branch`, `keep` and 1,000 element objects): the elements and result array alone take 127 bytes per row. With the cache they take 209 bytes per row. The cache costs about 81 bytes per row, 82 KB per 1,000 rows (2 slots, the rows array entry, the kept array). Keyed caches were estimated at about 11k retained slots per 1,000 rows.
- Size threshold: pass. Gzip 13344 against React Compiler's 19586 (ratio 0.681), no file above 1.15 times.
- Fast check: pass.

## Gate numbers

`pnpm --filter compare gate --set base --set tuning`

- Soundness: PASS on React and Preact, 0 differences.
- Total work on React, same cases as before this node (no `loop_shapes`): next 140, forgetti 0.8 92, React Compiler 166 (next was 166, level). On Preact: next 120, forgetti 0.8 69 (was 146).
- With `loop_shapes` added (including the `var` scenarios, soundness still 0 differences): React next 163, forgetti 0.8 103, React Compiler 218. Preact next 144, forgetti 0.8 81.
- `base/forloop`: next 11 against React Compiler 11 (was 17). Rows `same` and `one_title` are r0, and the rest equal React Compiler. The file line `base/forloop 11 > 0` still fails because forgetti 0.8 reports r0 on rows it renders wrongly (marked DIFF), which sets the better baseline to 0. No sound compiler can meet it.
- `base/map` and `tuning/throw_row` no longer appear in the per-file work failures. The work lines still FAIL (versus forgetti 0.8) by design: `hook_*`, `alias_*`, `throw_*` and others belong to later nodes.
- Gzip: PASS, 12403 against 18555 on the old case set (ratio 0.668), 13344 against 19586 with `loop_shapes` (ratio 0.681). Compiled share PASS, 58 of 59, React Compiler 54 of 58.
- No positional row fails a measured row against React Compiler, so `keyed-iterations` is not needed.

## Deviations

- `packages/forgetti/src/next/plan/baseline.ts` (not owned): `Context.perIteration` and the early return in `isPlainInput`, described above. Every other path in `isPlainInput` is unchanged.
- `benchmarks/corpus/tuning/loop_shapes/` (not owned): new corpus case, like `control_assign`.
- `packages/forgetti/src/next/plan/index.ts` needs no change: the `loops` entry already exists.

## Stubs left

- None.

## Gotchas

- A counter loop's result array (`rows` pushed in a loop, read after it) gets no `keep` block. The block that reads it is refused because the group is written in a loop, so the host element is rebuilt each render. Row elements keep identity, so no child re-renders. A later pass could re-plan that block with the array as a keep output.
- The fix-control-deps refusal is unchanged: a block after a loop that reads a local the loop wrote stays uncached.
- Rows are keyed by position only. A row that moves is a miss at both positions. `grow` in `base/forloop` is r4 because the loop reads `items` as a whole.
- A value that a group captures (an element pushed into `out` that reads `kids`) gets no cache. That is ownership's known gap.
- An element in a nested statement of a loop body (inside an `if`) is not planned. Only statements directly in the body are.
- Emit names the counter and the index parameter itself. `indexLocal` is left unset so a user `i` is never reused.
- A unit that only has loops gets `useCache(useRef, n)` with n counting child cache slots.

## Proposed learnings

- A planner that adds a block to a node must pack the node's slots again, since a block and a child cache share one index space | emit reads `first` and `parentIndex` as given | packages/forgetti/src/next/plan | yes
- A loop counter is written by its header, so a plain-input test that refuses every written binding refuses every counter | a pass over loops needs a per-iteration exemption | packages/forgetti/src/next/plan | yes

## Verification

- `pnpm --filter forgetti test`: 21 files, 506 tests, pass.
- `pnpm build`, `pnpm typecheck`, `pnpm format:check`, `pnpm --filter compare test` (11 pass, 2 skipped): pass.
- `rtk proxy pnpm lint`: 0 errors after a build.
- `pnpm --filter compare gate --set base --set tuning`: see Gate numbers.

## Size

- Estimated M, actual M (about 440 lines in `loops.ts`, 150 in tests, plus the corpus case).
