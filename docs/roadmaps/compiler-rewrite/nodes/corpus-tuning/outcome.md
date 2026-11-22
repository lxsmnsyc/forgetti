# Outcome: corpus-tuning

## Built

The set `tuning` has 19 cases in `benchmarks/corpus/tuning/<name>/{input.jsx,scenarios.js,meta.json}`, in `corpus-format` v1. Each `meta.json` has a one-line `tests` field next to `source`, `license` and `targets`.

Alias and mutation (debate P8, O12), React and Preact:

- `alias_push`: `const x = arr; x.push(b)`.
- `alias_field`: a fresh array stored in a field, mutated through the field.
- `alias_closure`: a closure that pushes to a fresh array, called in a loop.
- `alias_spread`: a spread copy mutated, the prop array must stay unchanged.
- `alias_unknown`: a fresh array passed to an unknown function from props that mutates it.
- `alias_branch`: mutation in one branch only.
- `alias_child`: an unknown call from props feeds a counted `Child`.

Hooks (debate P10):

- `hook_object` (React, Preact): custom hook returning an object, with state.
- `hook_nested` (React, Preact): a custom hook calling another, with state.
- `hook_use_cond` (React, Preact): `use(Ctx)` in a condition, a flag toggle and a context change.
- `hook_effect_event` (React only): `useEffectEvent`. Preact has no such hook.

Render discard (debate T1):

- `discard_transition` (React, Preact): `useDeferredValue`, a transition and an urgent update in one `act`. Preact runs transitions at once.
- `discard_suspense_mount` (React, Preact): computes a value, then `use(promise)` suspends on mount. Three scenarios: pending then resolved, already resolved, retag while pending.
- `discard_suspense_update` (React only): suspends on a new promise at update, then resolves. React hides the old content and Preact unmounts it, so the HTML differs between targets.
- `discard_strict` (React only): `StrictMode` double render and double effects.

Throw and retry (debate P17), React and Preact:

- `throw_call`: a call slot throws once on an update, then the same mounted component retries.
- `throw_group`: the second value of a grouped slot throws once after the first is computed.
- `throw_row`: a row of a per-row cache throws once on an update.
- `throw_boundary_swap`: the boundary renders the same child type at the same position with `safe` on and off.

The first three keep the component mounted across the throw. `gate.left` (from `benchmarks/corpus/shared/gate.js`) makes `risky` throw once. React retries the render at once on the committed cache ref. Preact goes to the boundary, which renders a fresh `<View />` of the same type at the same position, so the instance and its cache stay. A step then renders the same inputs again (`same`) and the HTML must show the right value. A compiler that writes a slot or its inputs before the throw returns a stale value there. forgetti 0.8 does: it differs on `arm`, `same` and `one_tag` of all three cases (React: 9 steps, Preact: 17 steps over the four throw cases). Each case also has a `mount_throws` scenario. `throw_boundary_swap` keeps a gate that throws on every attempt (`left` of `Infinity`) until its `reset` step.

Test: `benchmarks/compare/test/tuning.test.ts` checks at least 19 cases, a one-line `tests` for each, and for uncompiled output no failure, no error, and the same HTML on React and Preact for every step of cases that run on both.

## Proof

Not a fix node.

On the tuning set the baselines already fail, so the cases see real bugs (`pnpm --filter compare table --set tuning`):

- forgetti 0.8: 23 differing steps in 12 files on React, 11 steps in 8 files on Preact. Alias cases fail on `one_b` and similar steps.
- React Compiler 1.0: 0 differences.
- `next` stub: 0 differences, because it compiles nothing yet.

## Result

Not an experiment node.

## Deviations

- Added `benchmarks/compare/test/tuning.test.ts` and `tests?: string` in `CaseMeta` of `benchmarks/compare/src/types.ts` (outside the owned paths, the second approved by the coordinator). The verify command `pnpm --filter compare test --set tuning` fails before running: vitest rejects the unknown option `--set` (`CACError: Unknown option --set`). Use `pnpm --filter compare test`, which now includes the tuning self-check. The orchestrator should change the `verify` line of the brief.
- Added `benchmarks/corpus/shared/gate.js` and `benchmarks/corpus/shared/resource.js`, imported by the scenario files. Inputs do not import them.

## Stubs left

- None. The `next` compiler is still a stub, so its tuning numbers equal uncompiled output.

## Gotchas

- `pnpm --filter compare test` takes about 45 seconds now, up from about 4. The tuning self-check is most of it.
- forgetti 0.8 hangs forever (no harness timeout) on a case whose prop object is mutated in place and read as `res.status`. 0.8 caches `res.status` by the identity of `res`, so a resolved resource keeps throwing and React retries without end. The first draft of `discard_suspense_update` did this. The final cases keep promises immutable and read them with `use(res.promise)`. A later case that mutates props read by the component can hang the 0.8 cells of `gate`.
- React retries a render that throws once at once. Preact goes to the boundary at the first throw. The throw cases give equal HTML on both because the boundary renders a fresh element of the same type, which succeeds on Preact the way the retry does on React. The boundary must create a new element each time, since Preact skips an unchanged `children` vnode.
- If a failed render goes to the boundary, React drops the state of the child under it, Preact keeps it. `throw_boundary_swap` does not print state for this reason.
- Scenario `act` functions use `globalThis.__setN` and `globalThis.__reset`, set by the inputs. The shared gate and resource helpers keep the latest object in a module variable that the props factory sets.
- Do not format `input.jsx` files. The scenario and meta files are formatted with `pnpm exec oxfmt`.

## Proposed learnings

- Throw cases keep the component mounted and render a fresh child element in the boundary | a boundary that swaps in `<em>` remounts the child and hides stale cache writes | benchmarks/corpus | no
- Corpus cases read suspended data with `use(promise)` and keep props immutable | forgetti 0.8 hangs when a prop object is mutated in place and read as a property | benchmarks/corpus | no

## Verification

- `pnpm --filter compare test --set tuning`: fails, vitest rejects `--set` (verify command defect).
- `pnpm --filter compare test`: pass, 4 files, 11 tests (re-run after the throw case rewrite).
- `pnpm --filter compare table --set tuning`: runs all four compilers on 19 cases, no load failure.
- `pnpm --filter forgetti test`: pass, 196 tests.
- `pnpm build`: pass. `pnpm lint`: exit 0 (the `ESLint output (JSON parse failed ...)` line is the known wrapper message). `pnpm format:check`: pass. `pnpm --filter compare typecheck`: pass.
- `benchmarks/corpus/heldout/` was not opened.

## Size

- Estimated M, actual M.
