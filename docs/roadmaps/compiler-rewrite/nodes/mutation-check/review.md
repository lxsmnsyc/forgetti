# Review: mutation-check (`feat/mutation-check`, fd0485b)

Reviewer worktree: `.claude/worktrees/agent-aec85f69e93b079a2`. The expectations I wrote before reading the change are in `expectations.md` next to this file.

## Verdict

Changes requested. The way the check runs is sound: the oracle, a fresh module per mutant, fail-closed exits, and determinism are all right. It also catches real next bugs. But the default `--cap 2` hides most of next's failures. With the cap removed, 35 next mutants fail on 10 files instead of 8. Among the new ones is the brief's first hazard class: a changing global read in a same-module child's render (`discussions_table`, `PaginationContent` and `PaginationItem`). With no cap, the run also hangs forever on one mutant. Two acceptance items are therefore not met: "applied wherever its pattern fits", and "each difference recorded in `outcome.md`".

## What I reproduced

- `pnpm --filter compare mutate` (cap 2): exit 1. 1264 mutants, 1166 live, 98 inert, 0 broken, 8 failing, 29 allowed. The per-operator counts and the failing list match `outcome.md` exactly, so generation and verdicts are deterministic across two runs.
- `pnpm --filter compare typecheck`: pass. `pnpm --filter compare test`: 37 passed, 6 skipped. `pnpm format:check`: pass.
- Plain against plain on a live mutant (`heldout/cart_summary` `global-read/member#1`, both targets): 0 differences.
- I read next's compiled output for follow-ups A and D. I ran D and E under React Compiler with a scratch script, deleted afterwards. The reviewed worktree is clean.
- `mutate --cap 1000` on all dev sets: it hung (finding 2). I killed it after 32 minutes. Before the hang, 56 of 57 files had finished, and the 10 files listed under finding 1 were the only ones with failures. I then ran `--cap 1000` on those 10 files: exit 1, 35 failing next mutants (35 on React, 35 on Preact).

## Expectations checked

| Expectation | Result |
| --- | --- |
| Oracle is plain on the mutant, same target | Yes (`mutate/run.ts:316-328`). |
| Same run path as the gate | Mostly. It uses `writeModule` and `runScenarios`. The compile step is a copy of `compileCase` without the timing runs (`mutate/run.ts:72-148`). Its options match `src/compilers.ts` today. |
| Fresh module per mutant | Yes. Each mutant has its own case name, so its own output folder (`run.ts:254`), plus a new Vite server every 8 mutants. |
| Mutant reaches the compiler | Yes, through `CorpusCase.source`. Siblings are not mutated (a listed deviation; no case has siblings). |
| Marks do not leak through shared scenario objects | Yes. `__mutKey` is a new `Symbol` per loaded module (`helpers.ts:8`). |
| Plain failure fails the check | Yes, as broken, with exit 1 (`index.ts:126`). Syntax drops also exit 1. |
| Sealed set refused | Yes (`options.ts:38-44`). |
| Can fail | Yes. In the worker's run, forgetti-0.8 fails 788 mutants and React Compiler fails 672. |

## Findings

### 1. High: the default cap hides 27 of 35 failing next mutants

`mutate/options.ts:69` (default `--cap 2`) and `mutate/generate.ts:111-116` keep only the first 2 candidates per operator variant and file. The other 1056 candidates are counted and never run. The brief asks for each operator "applied wherever its pattern fits". `outcome.md` describes the flag but does not list the cap as a deviation.

Evidence: `--cap 1000` on the 10 files gives 35 failing next mutants. With the default cap there are 8. The new failures:

- `heldout2/discussions_table`: `global-read/member#3`, `#4`, `global-read/free#3`, `#4`, `closure-child/plain#3`, `#4`, `closure-child/memo#3`, `#4`, `child-impure/now|global|ref#3`, `#4`, `date-arg/probe#3`, `#4`, `identity-write/fn#2`, `alias-prop-call/call#26`. The hazard sits in `PaginationContent` or `PaginationItem`, which are `forwardRef` children, not `memo`. Next caches `<TablePagination {...pagination}>` on `pagination`, so the subtree never re-renders. It shows a stale global (plain `3`, next `2` at `same/same`, every step after). This is the O8 shape the brief names first, and it is the same root cause as follow-up D.
- `alias-prop-call` on `cart_summary` (`#8`, `#10`), `list_filters` (`#5`, `#7`), `table_sort` (`#4`, `#5`, `#6`), `discard_suspense_mount` and `discard_suspense_update` (`#2`). Preact only: `form_validation` (`#8`), `otp_input` (`#7`), `toast_stack` (`#12`).

Fix: run every candidate by default, or pick a cap per operator that provably reaches every component. Record every difference in `outcome.md`.

### 2. High: no per-mutant timeout, so an uncapped run hangs

`mutate/run.ts:279-331` (`runMutant`) has no time limit. With `--cap 1000`, `heldout2/toaster_store` `alias-prop-call/call#14` ran for over 30 minutes at 90% CPU and never ended. That mutant adds `__mutAlias(onHeightUpdate)` in `ToastWrapper` and renders the mark inside the measured `<div>`. The ref callback updates the height, the update re-renders, and the mark changes again. `outcome.md` "Gotchas" knows about such loops, but the runner does nothing about them. The cap is what hides this one.

Fix: give each cell a time limit, and count a mutant that runs out as broken (or "hung") in the report, which exits 1.

### 3. Medium: the clock is driven by reads, not by steps

`mutate/run.ts:31-39`: `readStep` moves the clock only on the first read after a counter reset. So the value seen at step k is "the number of earlier steps in which this cell read the clock". It is not the step index. A compiler that legally skips a read in one step (for example, a `memo` child it does not re-render) shows a different value on every later step, even where it renders fresh.

Evidence: `heldout/cart_summary` `global-read/member#1`, scenario `shopping`. The `Product` instances under `Cart` are not behind `memo` and re-render in next on every step. They show 9, 10, 11, 12, 13 where plain shows 13, 14, 15, 16, 17. That is a constant lag of 4 from skipped `memo` reads, not a stale value.

Consequences:

- The per-component `memo` exemption is needed today partly to absorb this lag.
- Difference step lists are inflated (95 steps for 8 mutants).
- A non-exempt mutant where a sound compiler skips an unobservable read would fail.

Fix: move the clock on the harness step index. A step callback in `runScenarios`, or a step number the runner sets, would do it.

### 4. Medium: the `memo` exemption is too broad

`mutate/ast.ts:527-582` (`findBehindMemo`) and `mutate/generate.ts:43-61` exempt every HTML difference of a mutant whose component is reachable from any `memo` node: the `memo` component itself, its whole subtree, and every other instance of those components. Debate-2's "`memo` stays exempt" covers a `memo` boundary skipping its render. It does not cover a stale value inside a body that did re-render, or in an instance outside `memo`.

Failure scenario: a future planner change caches `Cart`'s `<Product>` element wrongly. `cart_summary` `Product` is exempt everywhere because it also renders under `MemoProductItem`, so the stale value is reported as "allowed" and the check passes.

Today: in the one allowed mutant I checked, the differences in the instance outside `memo` were clock lag (finding 3), not a hidden bug. I did not check the other 28.

Fix, after finding 3: exempt only instances under `memo`. Or count a mutant as allowed only when its component renders only behind `memo`, and report the rest as failing.

### 5. Low: "live" counts the probe text, so some live mutants cannot fail

`mutate/run.ts:298-311`: a mutant is live when its plain HTML differs from the original's anywhere. Adding a probe makes that true even when the probe never changes.

Evidence: `identity-write/cond` renders `typeof X.displayName` after `if (__mutYes()) { X.displayName = ... }`. The `if` runs once at module load, so the probe shows `string` on every step and no compiler can differ. These 13 "live" mutants test nothing.

Fix: call a mutant live only when its probe changes between steps in plain. Report mutants that differ only at mount separately.

### 6. Low: marks count how many times code ran

`alias-prop-call`, `callback-mutate`, `result-mutate` and `default-param` count executions (`outcome.md` "Gotchas"). Example: `tuning/discard_suspense_mount` `alias-prop-call/call#2`, plain `4`, next `3`. It could be a cache error, or a different number of discarded Suspense renders. Triage this before filing it as a next bug.

### 7. Low: the compile step is a copy

`mutate/run.ts:72-148` re-implements `compileCase`'s compiler calls. If `src/compilers.ts` changes its options, the two drift apart. Fix: export a compile-once function, or a `timing: false` flag, from `src/compilers.ts`.

### Deviations

`test/mutate.test.ts` outside the owned paths, the `mutate/tsconfig.json` typecheck change, Babel 8 instead of oxc, and input-only mutation are all fine. The cap belongs in the deviations list (finding 1).

## The 8 next failures (cap 2)

- **A, real.** `heldout/cart_summary` `result-mutate/map#0`, compiled `Shop`: `keep($, 4, state.addedIds.map(...))` returns the previous array when its elements are equal. The mutant then writes its mark into that reused array, so next renders `2` where plain renders `1`. Next keeps a value that is changed after the call.
- **D, real.** `heldout2/discussions_table` `identity-write/fn#0`: `TablePagination` does not cache `typeof Pagination.displayName` itself. Its parent caches `<TablePagination {...pagination}>` on `pagination` (compiled line about 392), so `TablePagination` never re-runs. React Compiler also fails D on React (plain `string`, React Compiler `undefined`). The write happens in a render, which breaks the Rules of React. It is still a failure under debate-2's O10 rule. The same root cause produces the 15 new `discussions_table` failures in finding 1.
- **E, real but a design question.** `heldout/cart_summary` `callback-mutate/map#1`: React Compiler passes on React. It also caches `Cart`'s `.map`, so the mutation never re-runs. Next re-runs `Cart`'s map over a reused `lines`. A child that changes its props breaks the Rules of React, so React Compiler passes by accident. The orchestrator should decide whether next must handle this. The 9 uncapped `alias-prop-call` failures belong to the same class.
- **B, C.** I did not read their compiled output. The differences in the report match the shapes in `outcome.md` (filter: plain `3`, next `2`; module-object method in `.map`: plain `3`, next `2`).

## Oracle choices the coordinator asked about

1. **`memo` exemption per component:** too broad (finding 4). Today it is partly needed to hide clock lag (finding 3). Fix the clock first, then narrow the exemption to instances under `memo`.
2. **Global and `Date.now()` moving once per step:** right in principle, because a per-read counter depends on how many times React renders. The code moves it per step with a read, though, which makes values depend on the compiler's read history (finding 3). Use the harness step index.

---

# Round 2: `feat/mutation-check` at 1b16b8f

## Verdict

Approve with one known gap that the orchestrator must accept or fix. Round 1's findings 1, 2, 3 and 5 are fixed. Pool runs are deterministic, the clock proxy is sound, and the props-mutation flag is correct on all 22 mutants. The `memo` marks can still hide a difference that does not come from `memo` (finding R1). I built a counter-example that shows this. It does not change today's verdict on next, whose 25 failures stand, but it is a false-pass path for later planner changes.

## What I reproduced

- `pnpm --filter compare mutate`, run twice: exit 1 both times. 2320 mutants, 2010 live, 309 inert, 0 broken, 1 hung, 25 failing, 56 allowed (memo), 22 allowed (props). Both reports are byte-identical except for the time line (236 s), and they match the worker's numbers.
- `typecheck`: pass. `test`: 39 passed, 6 skipped. `format:check`: pass.
- The hung mutant is `heldout2/toaster_store` `alias-prop-call/call#14`, plain at 30 s: the render loop from round 1. It is reported and does not fail the check, as accepted.
- A scratch case in `benchmarks/corpus/zz_review/` (deleted afterwards; the worktree is clean) for the `memo` marks. `.out/mutate/report.txt` in the reviewed worktree now holds that scratch run's report, not the corpus run.

## Round 1 findings

| Round 1 | Status |
| --- | --- |
| 1. The cap hides failures | Fixed. No cap by default. All 25 failures of the uncapped round 1 run that are not props mutation still fail. |
| 2. No timeout | Fixed. 30 s per mutant, with the worker killed and replaced (`pool.ts:83-92`). A plain hang counts as hung. A hang during setup (`cell === ''`) also counts as hung, which is lenient but rare. A compiled hang counts as broken and fails. |
| 3. Clock driven by reads | Fixed (`run.ts:46-59`). See R3. |
| 4. `memo` exemption too broad | Narrowed to rendered instances, but a gap remains (R1). |
| 5. `identity-write/cond` cannot fail | Fixed. The write moved into render behind `if (X.p === undefined)`. 3 mutants now fail on `discussions_table`. |
| 6. Marks count executions | Moot under the props ruling: `discard_suspense` `alias#2` is now allowed (props). |
| 7. Copied compile step | Unchanged (low). |

## Findings

### R1. Medium: a `<mut-memo>` mark hides staleness inside a `memo` subtree that did re-render

`mutate/generate.ts:72-114` (`addMemoMarks`) and `mutate/run.ts:224-236` (`removeMemoMarked`, `compareCells`). Each `memo` body provides `MutantMemo = true` to its whole subtree. Any instance under it wraps its output in `<mut-memo>`, and a difference inside the mark is allowed. The mark records only that a `memo` sits somewhere above. It does not record that the `memo` skipped in that step. So a stale value caused by next's own caching below a `memo` that did re-render is allowed.

Counter-example. Same structure twice, once under `memo`, once not:

```jsx
const Hazard = forwardRef(({ k }, ref) => <i ref={ref}>a{k}</i>);
const Mid = ({ label }) => <b>{label}<Hazard k={label} /></b>;
function Parent({ n, cfg }) { return <p>{n}{cfg && <Mid {...cfg} />}</p>; }
const Box = memo(function Box({ n, cfg }) { return <Parent n={n} cfg={cfg} />; });
// WithMemo renders <Box/>; NoMemo renders <Parent/> directly. Steps change n, cfg stays the same object.
```

`mutate --set zz_review --operator global-read`, with the hazard in each copy:

- NoMemo (`HazardB`): fails. `no_memo/n2`: plain `<p>2<b>L<i>5bL</i></b></p>`, next `<i>4bL</i>`.
- WithMemo (`HazardA`): allowed as memo. `with_memo/n2`: plain `<p>2<b>L<mut-memo><i>2aL</i></mut-memo></b></p>`, next `<mut-memo><i>1aL</i></mut-memo>`.

The `2` in next's output shows `Box` and `Parent` re-rendered in that step. The stale value comes from next caching `<Mid {...cfg}/>` on `cfg`, the same bug as D, not from `memo` skipping.

Fix: stamp the mark with the step in which the nearest `memo` body last rendered. For example, the provider's value is the clock step at render, and `<mut-memo data-s={step}>`. Allow a difference only when the compiled run's stamp is older than the current step, so the boundary really skipped. I did not check whether any of the 56 corpus `memo` allowances falls into this gap.

### R2. Low: `default-param/existing` is always flagged as props mutation

`mutate/operators/default-param.ts:53-54` sets `propsMutation: true` for every `existing` mutant. When no scenario passes the prop, the default `{}` belongs to the component, and a cached default is the census D hazard, not props mutation. Today no corpus file produces an `existing` mutant (0 in the tally), and `added` is not flagged, so nothing is hidden now. Flag it only when a scenario passes the prop, or split it into two variants.

### R3. Clock proxy: sound

`resetClock` sets a `Proxy` as the prototype of the counter's `C`. The harness's `for (const k in C) delete C[k]` walks the prototype chain and calls the proxy's `ownKeys` once per clear. Nothing else enumerates `C`:

- `readCounts` copies own keys with a spread.
- `bump` uses get and set, which go through the default traps.
- No corpus file imports `C`.

The value equals the number of clears since the cell started (mount steps included), whatever was read. Run 1 and run 2 agree, which supports this.

### R4. Pool determinism: holds

Results are written by task id (`pool.ts:64`), every worker keeps its own `originals` and clock, and the two reports match. One small thing: the first mutant of a case in each worker pays for the original's plain run and the Vite start inside its 30 s budget. That is fine at the worker's 2 s maximum.

## Props mutation, all 22 allowed

Each is a write to a value reached through a prop, so allowing it is right under the user's ruling:

- `alias-prop-call` (19): every candidate is a prop read by construction. This includes the six that failed in round 1:
  - `discussions_table` `#26` (`Table:pagination`);
  - `table_sort` `#4`, `#5`, `#6` (`SortHeader:column`, `sorting`, `onSort`);
  - `list_filters` `#5`, `#7` (`Footer:todos`, `dispatch`);
  - `cart_summary` `#8`, `#10` (`Cart:products`, `onCheckoutClicked`).

  Several of these are function props (`onSort`, `dispatch`, `renderSeparator`, `children`). The mark then only counts how often the same closure comes back. That is legal caching, so allowing it is also right on the merits.
- `callback-mutate/filter#1` (`list_filters` `Footer`, `todos.filter`) and `callback-mutate/map#1` (`cart_summary` `Cart`, `products.map`): both lists are destructured props.
- `result-mutate/find#0` (`table_sort` `SortHeader:60`, `sorting.find`): `sorting` is a prop and `find` returns one of its elements.

The flag never hides a load failure, because `allowance` stays null for `load` (`run.ts:246-252`). It does hide error differences, on purpose (`run.ts:271-276`).

## next at 1b16b8f

25 failing mutants: A (2), C (1), and 22 on `discussions_table`, all caused by next caching `<TablePagination {...pagination}>` (the D class: global, clock, `ref` and `displayName` reads in `forwardRef` children). All fail on React, and 21 on Preact. These are real next soundness bugs for the follow-up nodes.
