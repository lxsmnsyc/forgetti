# Outcome: eligibility-writes

## Built

- `packages/forgetti/src/next/eligibility/index.ts`:
  - Results of hooks other than `useRef`, `useState`/`useReducer` and effects are watched like props. A write, update, delete or mutating method call on them, during render or in a closure, bails as `mutates-state`. A write whose chain starts with `.current` (`latest.current = x`) stays allowed.
  - Derived values (a conservative rule). One classifier, `findDerived`, labels an expression fresh, copy or watched. It runs on every local initializer, on every later `c = ...`, and on the root expression of every write chain, so `getBox(p).n = 1` and `const b = getBox(p); b.n = 1` take the same path. A value that mentions props, state, a hook result or a hook argument outside a nested function is derived.
    - Watched (may be the shared object itself): an identifier, `find()`, `a || b`, a conditional, any call that mentions a watched name, a call of a local function or function literal whose body mentions one (`const get = () => p.box; get().n = 1`, `(() => p.box)()`), `new` of a user class. Any write through it bails with the source's reason.
    - Copy (a new container holding shared objects): array and object literal, spread, `slice`, `concat`, `filter`, `map`, `flat`, `flatMap`, `toSorted`, `toReversed`, `toSpliced`, `with`, `Array.from`, `Object.assign({}, x)`, `Object.values/keys/entries/fromEntries`, `new Map/Set/Array/Object(x)`, and `reduce` with a fresh initial value. `sort`, `reverse`, `fill` and `copyWithin` return the class of their receiver. A write to the copy itself (`c[0] = y`, `c.push(y)`) stays allowed. A write below it bails.
    - Fresh: `split`, `JSON.parse/stringify`, `Object.create`, `String`, `Number`, `Boolean`, `BigInt`, `Symbol`, `parseInt`, `parseFloat`, `structuredClone`, `new Date/RegExp/Error/URL` and typed arrays.
    - A literal tracks each named field (`{ items, tag }`: `box.items.push(x)` is allowed if `items` is a new array, `box.tag.x = 1` bails if `tag` is a prop).
  - Elements handed out by a loop or callback (`for (const i of c)`, `c.forEach((i) => ...)`, also `p.items.forEach(...)`) are watched like the source. The accumulator of `reduce` is watched only when the initial value is watched or missing.
- `packages/forgetti/test/next/eligibility/eligibility.test.ts`: 46 new tests in four groups, each with allowed twins (`.current` write on a hook result, write to the copy, read-only handlers).
- Case 2 (instance kept in state): kept as a known false bailout. See Gotchas.

## Proof

- base `2e69323`, `pnpm --filter forgetti test test/next/eligibility` with the new tests: 9 failed (4 for hook results, 5 for spread copies), 62 passed. The 3 case 2 tests pass, so case 2 already bails today.
- branch: same command, 71 of 71 pass. `pnpm --filter forgetti test`: 20 files, 464 tests pass.

## Deviations

- Case 1 uses `mutates-state` because the `BailoutReason` contract has no `mutates-hook-result`. No change request written.

## Stubs left

- None.

## Gotchas

- Known false bailout (case 2): `const [store] = useState(() => new Store()); store.add(x)` bails as `mutates-state`. Allowing it is sound only if the planner never uses the instance's changing fields as a cache input. That needs a `phase-ir` change request that marks such bindings opaque. Not written, because the brief says to keep bailing unless that is accepted. Two tests pin the behavior (method call and field write, both marked "known false bailout"). Flip them if the planner rule lands.
- Hook result detection uses the hook name filter (`useX`). `useRef`, `useState`/`useReducer` and effect hooks (by preset import) are not treated as hook results.
- Why no derived form escapes: a value is fresh only when it is a literal without watched members or a call on the fixed fresh list. Every other expression that mentions a watched name, or calls a function that does, is watched or a copy with a measured safe depth.
- Known false bailouts, kept on purpose: an unknown user call with a watched argument (`getArr(p.x)`) is watched because it may return the shared object, so `const a = getArr(p.x); a.push(1)` bails. A DOM lookup keyed by a prop (`document.getElementById(p.id).classList.add('a')`, `const el = document.querySelector(p.sel); el.textContent = x`) bails. `new Store(p.x)` bails on writes to the instance. `p.items.map(i => ({ id: i.id }))[0].x = 1` bails (rare).
- Stores into a local: a watched or copy value written into a member of a local (`o.a = p.box`, `o[k] = ...`, `l.push(x)`, `m.set(k, x)`, `Object.assign(o, p)`) makes that member watched with the same source, per field for a static name and for the whole object otherwise. Writes to the container itself stay allowed. A group-by pattern (`g[k].push(item)`) is allowed, while `g[k][0].x = 1` bails.
- A call is watched when its callee or any argument mentions a watched name, including inside a function argument (`run(() => p.box).n = 1`). A function member of a literal that closes over a watched name makes the literal member watched. A local function is judged by every body assigned to it. `String`, `Number`, `JSON`, `Object`, `Array`, `Date`, `Map`, `Set` and the like count as builtins only when the name has no local binding.
- Locals declared inside handlers, effects and callbacks are classified like top-level ones. Names resolve by binding, so a handler-local shadow is not confused with an outer name. A handler parameter with no known source stays unwatched.
- Grouping code stays allowed. A member read (`g[k]`, `m.get(k)`) returns the element of a derived value with the matching depth, never the key. `get`, `at`, `find`, `findLast`, `pop` and `shift` on a builtin container (array literal, `new Map/Set/Array`) return what was stored, not their arguments. `m.set(k, v)` stores `v` only. A store through `(g[k] ||= []).push(x)` or `m.get(k).push(x)` resolves to the local it reads from. A watched value stored into a container marks only the depth where it lives: `g[k].push(i)` is allowed, `g[k][0].x = 1` and `m.get(k)[0].n = 1` bail. A write with an unknown key counts every stored field.
- Known gaps (not caught), for a follow-up node:
  - An imported helper, or a function received as a parameter, that returns a prop it captured: `helper()` with no watched argument is judged fresh. Hook results are watched, so a getter from a hook is covered.
  - A store whose target is not a name and not one of the forms above, such as `getList().push(p.box)`.
  - A store made by a callee that receives the local (`fill(o, p)`).
  - Aliasing a local container before the store (`const a = o; a.x = p.box; o.x.n = 1`).
  - A user object with a method named `get`, `find` and so on is not a builtin container, so it is judged by its arguments and stays watched.
## Corpus

- The 15 base and 20 tuning files (35) keep their eligibility result (old and new checker compared file by file). No file changed. A first version of the derived rule bailed `tuning/alias_field` (`const box = { items, tag }; box.items.push(b)`); per-field tracking fixed that. Only `base/bailout` bails (`mutates-props`).

## Proposed learnings

- None.

## Verification

- `pnpm --filter forgetti test`: 488 pass. `pnpm --filter forgetti typecheck`: pass. `rtk proxy pnpm lint`: no errors, warnings only. `pnpm format:check`: pass.

## Size

- Estimated M, actual M.
