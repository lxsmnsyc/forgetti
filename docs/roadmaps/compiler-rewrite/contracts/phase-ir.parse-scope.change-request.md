# Change request: phase-ir v2 to v3

- From node: parse-scope
- Status: accepted

## Problem

Two parts of the phase 1 types do not fit what a module holds.

- `Scope.kind` has no value for the module scope. Module bindings (imports, top-level helpers such as `costly` in `derived.jsx`) need a scope, and the phase-ir comment says scopes lie "inside a unit".
- `Reference.node` is typed `IdentifierReference`. In `<Child v={a} />`, `Child` is a reference to an import, but oxc-parser gives it as a `JSXIdentifier` node. Without it, `Child` would have no reference, and an import used only in JSX would look unused.

## Proposed change

```ts
export interface Scope {
  id: number;
  parent: number | null;
  // `module` is scope 0, the only scope with `parent: null`.
  kind: 'module' | 'unit' | 'function' | 'block' | 'branch' | 'loop' | 'catch';
  range: Range;
}
export interface Reference {
  range: Range;
  write: boolean;
  // A JSX tag name such as `Child`, or the object of `<ns.Child>`, is a JSXIdentifier.
  node: IdentifierReference | JSXIdentifier;
  scope: number;
  closure?: number;
}
```

`ScopeResult.bindingOf` takes the same union.

## Affected nodes

- `eligibility`, `ownership` and the planner nodes read `Scope.kind` and `Reference.node`.

## Workaround in place

- `packages/forgetti/src/next/parse/scope.ts` gives scope 0 (the module) kind `block` and `parent: null`. Code that walks up the scope chain stops at `parent === null`.
- JSX tag references are stored in `Reference.node` as `JSXIdentifier` nodes, typed as `IdentifierReference` by the guard `isIdentifierReference`. Check `node.type` before reading a field that only `Identifier` has.

## Decision

Accepted 2026-11-22 by the orchestrator after the fresh review of `parse-scope`. phase-ir is now v3. `src/next/ir.ts` and `src/next/parse/` apply it, so the workaround above is gone.
