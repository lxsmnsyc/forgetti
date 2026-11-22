---
name: compiler-api
version: 1
status: frozen
defined_by: contracts
---

# Contract: compiler-api

## Purpose

The public entry point of the new compiler. The harness, the vite and rollup plugins and the tests call it. Lives in `packages/forgetti/src/next/index.ts`.

## Interface

```ts
// Same shapes as 0.8 (`packages/forgetti/src/core/presets.ts`), so plugin options keep working.
export type ImportDefinition =
  | { kind: 'named'; name: string; source: string }
  | { kind: 'default'; source: string };

// Serializable, as in 0.8. Plugins pass presets through JSON-like config.
export interface RawRegExp { source: string; flags: string }

export type HookType =
  | 'ref'           // useRef: the result is a stable object
  | 'memo'          // useMemo: the callback runs only when deps change; the result is opaque
  | 'callback'      // useCallback: the result is opaque
  | 'effect'        // useEffect, useLayoutEffect, useInsertionEffect: the callback never runs during render
  | 'state'         // useState, useReducer: [value, setter]; value is opaque and never mutated, setter is stable
  | 'use'           // use(): may be called in branches and loops, never cached
  | 'effect-event'; // useEffectEvent: the result is never an input of any slot

export interface Preset {
  filters: { component: RawRegExp; hook?: RawRegExp };
  runtime: { useRef: ImportDefinition };
  imports: {
    hooks: (ImportDefinition & { type: HookType })[];
    // HOCs whose first argument is a component, such as memo and forwardRef.
    hocs: ImportDefinition[];
  };
}

export interface CompileOptions {
  preset: 'react' | 'preact' | Preset;
  filename: string;
  sourceMap?: boolean;
}

export type BailoutReason =
  | 'mutates-props'
  | 'mutates-state'
  | 'mutates-hook-argument'
  | 'stores-fresh-in-ref'
  | 'stores-fresh-in-module'
  | 'returns-fresh-from-hook'
  | 'escaping-closure'
  | 'conditional-hook'
  | 'unsupported-syntax';

export interface Diagnostic {
  unit: string; // component or hook name
  reason: BailoutReason;
  start: number; // UTF-16 index into the input
  end: number;
  message: string;
}

export interface CompileResult {
  code: string;
  map: import('magic-string').SourceMap | null;
  diagnostics: Diagnostic[];
  // Every component and hook found, compiled or not, for the bailout-rate gate.
  units: { name: string; compiled: boolean }[];
}

export function compile(code: string, options: CompileOptions): CompileResult;
```

## Behavior

- Pure function of its inputs. It never throws on valid JS, JSX or TS.
- `oxc-parser`'s `parseSync` does not throw. When its `errors` array holds an entry with severity `Error`, `compile()` throws an `Error` whose message is `<first error message> (at <first label start>)`. Entries with other severities are ignored.
- Comments, needed for `@forgetti skip`, come from `parseSync`'s `comments` array. The `Program` node does not carry them.
- Every offset (`Diagnostic.start`, `Diagnostic.end`, `Range`) is a UTF-16 code unit index into the input string, as oxc-parser and magic-string use. Not a byte offset.
- `compile()` parses with `preserveParens: false`.
- A unit that bails out is left byte for byte as it was, and gets one `Diagnostic`.
- Code outside components and hooks is not changed, except for added imports.
- `/* @forgetti skip */` before a unit leaves it uncompiled with no diagnostic, like 0.8.

## Stub

`contracts` ships `compile()` returning the input unchanged, with `map: null` and `units` filled from a text scan, so the harness can run before any phase exists. The scan lists `function Name` declarations and `const Name = function | arrow` declarations whose names match the preset filters. The `'react'` and `'preact'` presets use `^[A-Z]` for components and `^use[A-Z0-9]` for hooks, so a name that starts with a non-ASCII capital is not a component. Every listed unit has `compiled: false`.

## Contract tests

`packages/forgetti/test/next/api.test.ts`.

## Changes

- v1: initial, frozen by `contracts`. Parse error message format, severity filter, stub scan and lint-style array types are the only differences from the draft.
- v1 note (2026-11-22): "like 0.8" for `@forgetti skip` means where users put the comment, not 0.8's exact Babel comment attachment. A skip comment before `export function Foo`, or before a statement that wraps the unit in a HOC call, also skips it. The hook filter is `^use[A-Z0-9]`, so `use2` is a hook, unlike 0.8.
