# Outcome: parse-scope

## Built

- `packages/forgetti/src/next/parse/index.ts`: `parseAndScope(code, { filename, preset })` returns `ParseResult`, which is `ScopeResult` plus `globals: Reference[]` (references that resolve to no binding). It parses with `parseSync` (`preserveParens: false`) and throws `<message> (at <offset>)` on the first `Error` severity entry, like `compile()`. Also re-exports `PRESETS` and `resolvePreset`.
- `packages/forgetti/src/next/parse/presets.ts`: `PRESETS.react`, `PRESETS.preact` (compiler-api `Preset` shape, with hook types) and `resolvePreset()`.
  - React: `useRef` ref, `useMemo` memo, `useCallback` callback, `useEffect`/`useLayoutEffect`/`useInsertionEffect` effect, `useState`/`useReducer` state, `use` use, `useEffectEvent` effect-event. HOCs `memo`, `forwardRef`.
  - Preact: the same from `preact/compat`. `preact/hooks` 11.2 lacks `use`, `useEffectEvent` and `useInsertionEffect`, so its list leaves them out. HOCs from `preact/compat`. Runtime `useRef` from `preact/hooks`.
- `packages/forgetti/src/next/parse/scope.ts`: `buildScopes(program)` builds scopes, bindings and references for the whole module in one walk, then resolves references up the scope chain. Also `isIdentifierReference()`, which narrows to `IdentifierReference | JSXIdentifier`.
- `packages/forgetti/src/next/parse/units.ts`: `findUnits()` applies the 0.8 rules: a function declaration or expression whose own name matches a filter, the function value of a variable whose name matches, or the first argument of an imported HOC (named import, renamed import or namespace member such as `React.memo` from `import * as React`). Async and generator functions are not units. `/* @forgetti skip */` and `// @forgetti skip` set `skip: true` and keep the unit in the list.
- `packages/forgetti/test/next/parse/units.test.ts` (47 tests) and `scope.test.ts` (40 tests).
- `packages/forgetti/src/next/ir.ts`: phase-ir v3. `Scope.kind` has `'module'`, and `Reference.node` and the `bindingOf` parameter accept `JSXIdentifier`.

### Shape of the result

- `bindings[id].id === id`. Ids are renumbered: each unit's own parameters, then the rest of the unit's bindings in source order, unit by unit, then every other binding in source order. The `derived`, `map` and `ternary` fixture ids come out as the fixtures say.
- Scope 0 has kind `module` and `parent: null`.
- A unit's function scope has kind `unit`. Parameters and body share that scope, unless a parameter has a default value or a computed key. Then the body gets a child `block` scope that also receives the body's `var` declarations, as the spec says, so defaults never see body declarations. Babel gets this wrong, so the Babel cross-check does not cover it. Hand tests do.
- A function expression's own name sits in a `block` scope between the parent and the function scope, so `function F(F)` and `function G() { var G }` give two bindings each.
- A class `static {}` block is a `block` scope that receives its own `var` declarations.
- `branch` scopes: `if` arms, each `switch` case, conditional expression arms, the right side of `&&`, `||`, `??` and of `&&=`, `||=`, `??=`. `loop` scopes: the whole `for`/`for...in`/`for...of`/`while`/`do` statement, minus the `for...in`/`for...of` right side, which runs once. `catch`: the clause, parameter and body together.
- `let`/`const`/`class`/`function` in a `switch` case bind in a `block` scope around all cases, as the language does. The case's statements still run in the case's `branch` scope.
- `Reference.closure` is the outermost `function` scope between the reference and its unit, so it names the closure value the unit creates during render. It is unset outside units and directly in the unit body.
- `Reference.write` is true for `=`, compound and logical assignment targets, `++`/`--`, destructuring assignment targets and a bare `for (x of ...)` left side. A compound assignment is one write reference, not a read and a write.
- `Binding.declaration` is the range of the declaring identifier. `imported.name` is the imported name, `'default'` or `'*'`.
- `bindingOf()` answers for reference nodes and for declaring identifiers.
- Not references: TS type positions (any `TS*` node except `as`, `satisfies`, `!`, `<T>x` and instantiation wrappers), type-only imports, a TS `this` parameter, non-computed member properties and keys, labels, intrinsic JSX tags (`div`, `my-el`), `this` in `<this.Foo>` and closing tags.

## Proof

- Units: each base corpus file is compiled with the 0.8 Babel plugin while its `Optimizer` is mocked to record the function node it receives. The unskipped units of `parseAndScope` have the same start offsets on all 15 files of `benchmarks/corpus/base`, and on 23 edge cases (HOC forms, shadowed `memo`, namespace and default imports, nested units, methods, skip comments, async and generator).
- References: on all 15 corpus files and a stress module (hoisting, destructuring, every loop form, labels, catch pattern, switch, named function and class expressions, computed keys, JSX member tags), every read reference resolves to the same declaring identifier, or to global, as Babel's `scope.getBinding` says.

## Deviations

- Edited `packages/forgetti/src/next/ir.ts` (outside the owned paths, approved by the orchestrator) to apply the accepted change request `contracts/phase-ir.parse-scope.change-request.md`: the `module` scope kind and `JSXIdentifier` references. The orchestrator updates the contract text to v3. The request file name has the node in it because `contracts/phase-ir.change-request.md` already holds the accepted request from `emit`.
- Hook filter is `^use[A-Z0-9]` (compiler-api), not 0.8's `^use[A-Z]`. So `use2` is a hook here and not in 0.8. A test records this.
- A skip comment before `export function Foo` or `export const Foo` skips the unit. 0.8 attaches that comment to the export statement and compiles the unit anyway. A skip comment before a statement that holds a HOC call also skips the HOC argument, which 0.8 never skips. The search for that statement stops at the nearest enclosing function.
- `compile()` in `src/next/index.ts` still uses its text scan. The brief does not ask to wire phase 1 in, and `index.ts` is outside the owned paths.
- No other file outside the owned paths and `nodes/parse-scope/` changed, apart from the change request.

## Stubs left

- None in this node. `compile()` does not call `parseAndScope` yet. The node that wires the phases does that.

## Gotchas

- The parse module imports `isNode`, `getChild` and `getChildren` from `src/next/emit/ast.ts`. Changing those helpers changes phase 1.
- A JSX tag reference has `node.type === 'JSXIdentifier'`. Check `node.type` before reading a field that only `Identifier` has.
- `arguments` resolves to global. `this` is not an identifier and has no reference.
- Not walked: enum member initializers, `namespace` bodies, `import x = require()` and `with` bodies. A TS enum declares a binding of kind `const`.
- `var` redeclared with the same name gives one binding. The second declarator's initializer is not a write reference.
- Scope ids follow the walk, and the walk visits a `for...in`/`for...of` right side before the loop scope opens. References are sorted by position, scope ids are not.
- The `units` test mocks `src/core/optimizer` with `vi.mock`. It keeps working only while 0.8 calls `new Optimizer(ctx, path).optimize()` once per unit.

## Proposed learnings

- Check unit detection against 0.8 by mocking its `Optimizer`, not by reading its output | the mock gives the exact node list without parsing 0.8 output | packages/forgetti/test/next | yes
- Cross-check scope resolution against Babel's `scope.getBinding` | it is an independent resolver already in the dev dependencies | packages/forgetti/test/next | yes

## Verification

- `pnpm --filter forgetti test test/next/parse`: pass, 2 files, 87 tests.
- `pnpm --filter forgetti test`: pass, 10 files, 196 tests.
- `pnpm build`, then `pnpm lint`: exit 0, no errors (warnings only in 0.8 files and examples).
- `pnpm --filter forgetti typecheck`: pass.
- `pnpm format:check`: pass.

## Size

- Estimated L, actual L: 1,334 lines of source and 523 of tests.

Landed on `batch/compiler-rewrite` as `554eee0`. phase-ir v3 is in the contract.
