# Outcome: eligibility

## Built

- `packages/forgetti/src/next/eligibility/index.ts`: `checkEligibility(scope: ParseResult, preset: Preset): Eligibility[]`. One entry per `scope.units` entry, in unit order, `unit` = `Unit.id`. A unit with `skip: true` is still checked; `compile()` decides what to do with skips. When a unit has several problems, the one earliest in source order is reported. `range` covers the offending expression, `message` names the unit and the name involved.
- `packages/forgetti/test/next/eligibility/eligibility.test.ts`: 49 tests, one per reason plus the allowed twin, plus the 15 base-corpus files.

### Rules

- `mutates-props`: first parameter of a component. `mutates-hook-argument`: every parameter of a hook. `mutates-state`: the first element of `const [v] = useState/useReducer()`. A mutation is `a.b = x`, `a.b++`, `delete a.b`, or a call of push, pop, shift, unshift, splice, sort, reverse, fill, copyWithin, set, add, delete or clear on a member chain rooted at a watched name. Aliases (`const items = props.items`, destructuring) are watched too. Writes inside nested functions count too (safe side). Rebinding the name itself is not a mutation. `Object.assign`, `Object.defineProperty`, `defineProperties` and `setPrototypeOf` on a watched name count. A function declaration in the body is a closure, like an arrow.
- `stores-fresh-in-ref`: `ref.current = <fresh>` during render, where `ref` is `const ref = useRef()`.
- `stores-fresh-in-module`: a fresh value assigned to, stored in a field of, or pushed into a module-level binding (not an import) or a global such as `window`.
- `returns-fresh-from-hook`: a hook returns a const holding a fresh value that a closure changes later. A plain `return { x, y }` is allowed (corpus `hook` needs this).
- `conditional-hook`: a call named like a hook (preset filter, `useX()` or `React.useX()`) in a `branch` or `loop` scope, or after a statement that can return early. Calls whose import resolves to a preset hook of type `use` are exempt. Hook calls inside nested functions are ignored.
- Fresh: object, array, `new`, function, class or JSX literal, or a `const` initialised with one (through `const` chains). Calls are not fresh.

## Proof

- `pnpm --filter forgetti test test/next/eligibility`: 49 pass. `bailout` reports `mutates-props` at `props.box.n += 1`; the other 14 base files are eligible in every unit (including `hook`, `usectx`, `earlyreturn`, `callback`).

## Deviations

- None outside the owned paths. It imports `isIdentifierReference` from `../parse/scope`.

## Stubs left

- None. `compile()` does not call `checkEligibility` yet; the wiring node does.

## Gotchas

- It takes `ParseResult` (needs `globals`), not plain `ScopeResult`, and the resolved `Preset` (`PRESETS.react`), not the option string.
- `escaping-closure` and `unsupported-syntax` are never returned. Ownership reports the first.
- Mutating a hook's result (other than the `useState` value) is not caught.
- Fresh-value stores (ref, module, hook return) are only checked in render code, not in closures. A late `let` alias (`let x; x = props.box; x.n = 1`) is not tracked.
- `returns-fresh-from-hook` is a narrow reading of the debate text; see the log.

## Proposed learnings

- None.

## Verification

- `pnpm --filter forgetti test`: pass, 11 files, 245 tests.
- `pnpm lint`: no findings in eligibility files; remaining errors are pre-existing (vite, rollup, examples). `pnpm --filter forgetti typecheck` and `pnpm format:check`: pass.

## Size

- Estimated M, actual M: about 520 lines of source and 280 of tests.
