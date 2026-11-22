# Outcome: ownership

## Built

- `packages/forgetti/src/next/ownership/index.ts`
  - `analyzeOwnership(scope: ScopeResult, unit: number): OwnershipReport`. `OwnershipReport` is `OwnershipResult` plus `bailout?: Extract<Eligibility, { ok: false }>`, which is phase-ir v4 as asked in `contracts/phase-ir.ownership.change-request.md`. `bailout` is set (reason `escaping-closure`) when a closure leaves render too early, and the key is absent otherwise. `unit` is `Unit.id`. An unknown id gives an empty result with no `bailout`.
- `packages/forgetti/src/next/ownership/walk.ts`: `UnitWalker` walks the unit's render code (not nested function bodies) and records stores, unions, mutations, escapes and input facts. It repeats until the set of fresh bindings stops growing.
- `packages/forgetti/src/next/ownership/groups.ts`: `GroupBuilder` runs union-find over fresh bindings, builds `Group`s, freeze points, inputs, the opaque list and the escape check.
- `packages/forgetti/src/next/ownership/methods.ts`: method and global lists (read methods, callback methods, mutating methods, pure globals, known constructors).
- `packages/forgetti/test/next/ownership/ownership.test.ts`: 70 tests.

### Rules

- Locals: bindings in the unit scope or its blocks, not inside a nested function, not parameters or catch names. Only locals can be fresh.
- Fresh: object, array, `new`, function, class or JSX literal, and any local that receives a fresh value or an alias of one. Every fresh local is a member of exactly one group, including a lone closure or JSX value (`const onClick = () => ...` is its own group with its captured names as inputs). A call result is not fresh, unless the call received a fresh value (then it may return it).
- Joins: assignment and declaration (`x = arr`), destructuring, a store into a field or element (`box.items = arr`, `list[0] = item`), a non-read method on a fresh receiver with fresh arguments (`push`, `Map.set`, `Set.add`), the parts of an object, array, JSX or `new` literal, the arms of `?:`, `&&`, `||`, closure capture (any fresh local read inside the closure), every fresh argument of one unknown call, and a member read (`a[0].x`, except `.length`/`.size`). A spread copy (`[...a]`, `{...a}`) of a fresh source joins the source, because the copy shares its nested values (as `a.slice()` does). A spread of a non-fresh value, such as a prop, gives a new group (`alias_spread`).
- Mutations (in source order, deduplicated, with the innermost scope): a member write, update or `delete` rooted at a member; a rebind of a member (`y = x`); any method on a fresh receiver that is not in `READ_METHODS`; a call of a fresh closure; an unknown call or hook call that receives a fresh value; a callback method call (`forEach`, `map`, ...) whose callback is a mutating closure (it mutates what the callback captures), or whose callback writes through its parameters (it mutates the receiver). An inline callback is scanned for that; any other callback (a local, module function, prop, member or call result) is unknown code and is assumed to write, unless it is a known pure global such as `console.log` or `String`. and the initial value of `reduce`/`reduceRight`. A read-only callback is not a mutation.
- Not mutations: read methods (`join`, `slice`, `map`, ...), `.length`/`.size`, `Math.*`, `Number.*`, `JSON.stringify`, `Object.keys/is/hasOwn`, `Array.isArray`, `console.*`, global `String`/`Number`/`parseInt`/...
- `frozenAt`: the end of the last mutation, extended to the end of every loop scope that holds it but does not hold all of the group's literals. With no mutation, the end of the last store or literal.
- `created`: every literal range stored into the group, nested ones included, sorted.
- `inputs`: non-fresh bindings read by the group's stores, literals (closure bodies included), mutations, and the conditions (`if` test, case test, loop test/update/right side, `?:` test, logical left side) of stores and mutations whose arm does not hold the group's first literal. Parameters, outer non-module names, hook results, opaque locals and call results are inputs as they are. Locals declared inside the group's span (from first literal to `frozenAt`, such as loop variables) and call-free consts are traced to what they read. Module-level names, imports and names declared inside the read range (closure parameters) are skipped. A read of another group's member adds that group's inputs (transitively).
- `opaque`: non-fresh locals changed during render by a member write or a built-in mutating method (`const v = pick(); v.push(1)`), plus the locals they alias through `const w = v`, plus non-fresh locals written inside a closure (`let total; const add = v => { total += v }`).
- Mutating closure: a closure whose body (nested functions included) writes (`x.n = 1`, `x.n++`, `delete x.n`) or calls a method outside `READ_METHODS` (`x.push(1)`) through `x`, where `x` is a captured fresh local or a name declared inside the closure that aliases one. A name aliases one when it comes from an initializer or assignment rooted at one (`const x = items`, `const y = items[0]`, `const z = items.filter(f)`), a `for...of` over one, or a parameter of a callback method called on one (`items.forEach((i) => ...)`). Calling a local that holds a mutating closure also counts, and so does a callback method on such a value with a callback that is not an inline function and not a pure global (`() => items.forEach(bump)`). A binding holds one when it receives such a closure, directly, by alias or inside a literal. Objects the closure builds itself (`const next = { ...opts }; next.y = 1`) and rebinding a captured local (`out = []`) do not count.
- `escaping-closure`: an escape is a JSX prop or child value, a return value, or the arguments of an unknown or hook call. It bails when (a) the escaping value is or holds a mutating closure, at any point (an event handler or effect runs after render and would change a cached value), or (b) the escaping value's group holds any closure and the group's last mutation (loop-extended) ends after the escape ends. The reported escape is the one that ends first, so the innermost (the JSX prop, not the whole element). The range is the escaping expression or call; the message names the unit and a fresh value it holds. Read-only handlers (`() => setX(items.length)`) stay compiled.

### Tuning alias cases (asserted in the test)

| case | members | mutations | frozen after | inputs |
| --- | --- | --- | --- | --- |
| alias_branch | out | `out.push(b)` (branch) | `out.push(b)` | a, b, flag |
| alias_child | no group | | | |
| alias_closure | out, add | `add(v)` (loop body) | the `for...of` | list |
| alias_field | items, box | `box.items.push(b)` | that call | a, b, tag |
| alias_push | arr, x | `x.push(b)` | that call | a, b |
| alias_spread | copy | `copy.push(extra)` | that call | list, extra |
| alias_unknown | arr, n | `grow(arr, b)` | that call | a, b, grow |

## Deviations

- `escaping-closure` is reported in `OwnershipReport.bailout`, a field the frozen phase-ir v3 lacks. Change request: `contracts/phase-ir.ownership.change-request.md` (named after the node because `contracts/phase-ir.change-request.md` already holds the accepted request from `emit`). `ir.ts` is not edited. The wiring node must check `bailout` before planning: a unit with it set gets no plan, as for an `ok: false` eligibility entry.
- No files outside the owned paths, `nodes/ownership/` and the change request changed.

## Stubs left

- None in this node. `compile()` does not call ownership yet; the wiring node does.

## Gotchas

- It takes a plain `ScopeResult`. Global names are found by `bindingOf()` returning undefined.
- Groups are ordered by their first literal; `Group.id` is the index. Members, inputs and opaque ids are sorted ascending.
- A rebind of a member is a mutation, so a `let el` written in each `switch` case (`base/switch`) has three mutations and is frozen after the switch. A planner that caches per arm must handle that.
- A binding can sit in `opaque` only when it is not fresh; members are never opaque.
- Callback methods (`forEach`, `map`, `filter`, `reduce`, `sort`, ...) on any receiver are assumed to call their callback now and not keep it, so they are mutations but not escapes.
- Mutation scope is the innermost scope by range. A mutation in a `for...of` right side is seen as inside the loop.
- A spread copy of a fresh value joins its source's group (a change from the debate's "a spread copy starts a new group", which is unsound for nested writes). Only spreads of non-fresh values start a group.
- A spread copy of a prop shares the prop's nested objects: `const copy = [...items]; copy[0].x = 1` mutates a prop element and nothing bails. Ownership does not watch props; that is eligibility's job and goes to a follow-up.
- Member reads join (`const label = a[0].x` puts `label` in `a`'s group), which keeps nested aliasing safe but makes groups larger.
- Known gap: an unknown call inside a closure that receives a captured fresh value (`onClick={() => mutate(items)}`) does not make the closure mutating. Counting it would bail every `onSelect(items)` handler. If `mutate` changes `items` after render, a cache hit shows the change.
- A callback that is not an inline function (`items.forEach(bump)`, `items.map(onItem)`, `items.map(api.fix)`) is assumed to write through its parameters, so the call mutates the receiver, and inside a closure it makes the closure mutating. Only inline callbacks are scanned. Known pure globals are exempt.
- On the base and tuning corpus (45 units), no unit bails with `escaping-closure`.

## Proposed learnings

- Assert ownership output as names and source text, not ids and offsets | the expectations then read like the code and survive id renumbering | packages/forgetti/test/next/ownership | yes

## Verification

- `pnpm --filter forgetti test test/next/ownership`: pass, 1 file, 70 tests.
- `pnpm --filter forgetti test`: pass, 15 files, 366 tests.
- The reviewer's probes (scratchpad `probe/probe.test.ts`, `corpusprobe/c.test.ts`): every probe gives the expected result, and none of the 45 corpus units bails.
- `pnpm --filter forgetti typecheck`: pass.
- `pnpm build`, then `pnpm lint`: exit 0 (warnings only, none in ownership files).
- `pnpm format:check`: pass.

## Size

- Estimated L, actual L: about 2,000 lines of source and 800 of tests.
