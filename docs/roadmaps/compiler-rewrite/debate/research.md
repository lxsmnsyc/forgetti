# Compiler rewrite: research

Status: research for the compiler rewrite. Nothing here is decided. The debate in `docs/roadmaps/compiler-rewrite/debate/debate.md` settles the phase design. The roadmap comes after the debate.

## Summary

- forgetti 0.8 is more granular than React Compiler 1.0, but it is not sound. In a 15-file corpus it showed three semantic differences from uncompiled React. React Compiler showed none.
- React Compiler is not optimal either. It rebuilds every row of a list when one item changes. It recomputes the active branch of a ternary when only an inactive branch input changes. It skips caching some call results.
- The rewrite keeps the tree cache. Branches and loop iterations keep their own child caches. It must add what 0.8 lacks for soundness:
  - a mutation model
  - no caching of `use()` or hook results
  - a bailout when a component breaks the Rules of React
- The open question for the debate is how to get that soundness without copying React Compiler's design.

## Fixed decisions

- **Toolchain**: oxc for parsing and magic-string for output, like silmaril, solid-optimizer, solid-sfc and solid-styled. Babel is no longer a dependency of the compiler.
- **Cache structure**: a tree cache. A component gets a root cache, and branches and loops get child caches inside it.
- **Targets**: React 19.x and Preact 11.x.
- **Independence**: the phases are designed from scratch. React Compiler is only measured as a black box.

## Constraints from React 19 and Preact 11

Sources were checked on 2026-11-21 against react 19.3.1 and preact 11.2.0.

| Constraint | Source |
| --- | --- |
| `useMemo` may discard its cache: on Fast Refresh edits, when a component suspends on first mount, and in future features. A lost cache must only cost a recompute. | https://react.dev/reference/react/useMemo |
| `use()` may be called in `if` blocks and loops, but not in `try`/`catch`. It must run on every render that reaches it, so its result is never cached. | https://react.dev/reference/react/use |
| Every other hook must be called unconditionally, in the same order, before any early return. The cache hook is one of them. | https://react.dev/reference/rules/rules-of-hooks |
| `c()` from `react/compiler-runtime` is undocumented and React-only. Preact 11 has no equivalent. forgetti keeps its own runtime. | https://react.dev/reference/react-compiler/target |
| StrictMode calls the component body and `useMemo` twice in development. Cache initialization must be pure. | https://react.dev/reference/react/StrictMode |
| `useEffectEvent` (React 19.2, Preact 11 compat) returns a function that is never a dependency. | https://react.dev/blog/2025/10/01/react-19-2 |
| `ref` is a plain prop in React 19 and Preact 11. `forwardRef` needs no special case. | https://react.dev/blog/2024/12/05/react-19, https://preactjs.com/guide/v11/upgrade-guide/ |
| Preact 11 compares hook dependencies with `Object.is`, like React. | https://preactjs.com/guide/v11/upgrade-guide/ |
| Server Components cannot use hooks. They are never compiled. | https://react.dev/reference/rsc/server-components |

Not verified: whether the second StrictMode render reuses the first render's `useMemo` and `useRef` values. The cache must give correct output either way.

## forgetti 0.8

The 0.8 compiler runs on Babel paths in place. Its steps are pre-inlining, simplification, expansion, JSX outlining, memoization and post-inlining. `docs/optimizations.md` shows each step's output.

- **Unit**: every sub-expression. Each input gets an `$$equals` slot, and each derived value gets a slot keyed on the flags of its inputs.
- **Branches**: `if`, `switch`, `try` and ternaries get child caches through `$$branch(parent, index, size)`. A branch that is not taken keeps its cache, so switching back hits.
- **Loops**: each iteration gets a child cache at index `_id++`. Iteration caches are keyed by position.
- **JSX**: each JSX region is outlined into a module-level component wrapped in `memo`. It receives one array of values.
- **Purity**: every call is cached by its arguments. Nothing tracks mutation.
- **Storage**: the root cache comes from `useRef` or `useMemo`.

## React Compiler 1.0, observed as a black box

Measured with `babel-plugin-react-compiler@1.0.0`. Only the output was read.

- **Unit**: a scope groups the values that are created or mutated together. A scope compares all its inputs, then recomputes all its outputs.
- **Branches**: a ternary or a JSX tree inside a branch is one scope, keyed on the inputs of every branch.
- **Loops**: a loop or a `.map` call is one scope around the whole result. Rows have no cache of their own.
- **Early returns**: values are cached on both sides of an early return in one flat array.
- **Context**: `use(Ctx)` runs on every render.
- **Bailouts**: a component that mutates props is left uncompiled, and the logger reports why.
- **Gaps**: in `derived.jsx`, `costly('x', a)` runs on every render while `costly('y', b)` is cached. In `hook.jsx`, neither call is cached.

## Measured comparison

The corpus, scripts and outputs are in `docs/roadmaps/compiler-rewrite/debate/evidence/`. Versions: babel-plugin-react-compiler 1.0.0, forgetti 0.8.5, react 19.3.1, happy-dom 21.0.4, Node 26.12.1. Render counts come from uncompiled child components. Recompute counts come from a counted `costly()` function.

### Size and slots

| File | React Compiler bytes (gzip) | React Compiler slots | forgetti bytes (gzip) | forgetti slots |
| --- | --- | --- | --- | --- |
| `derived` | 591 (324) | 6 | 1636 (554) | 13 |
| `ternary` | 418 (265) | 4 | 1807 (563) | 3+5+5 |
| `map` | 554 (312) | 5 | 1395 (508) | 8 |
| `forloop` | 586 (331) | 5 | 2369 (760) | 7, then 11 per iteration |
| `switch` | 1036 (404) | 7 | 2660 (756) | 8+6+6+1 |

forgetti output is 1.7 to 4.3 times larger in raw bytes on the 14 files React Compiler compiled. The full table is in `evidence/out/compile-table.json`. forgetti compiles 1.5 times faster, at 1.3 to 2.7 ms per file against 1.9 to 4.8 ms. The rewrite moves to oxc, so compile time will be measured again.

### Correctness

| Case | Uncompiled | React Compiler | forgetti 0.8 |
| --- | --- | --- | --- |
| `forloop`: one item changed | updates | updates | stale |
| `usectx`: context changed from A to B | shows B | shows B | shows A |
| `bailout`: props mutated during render | runs every render | bails out, runs every render | runs once, output differs |

Causes in 0.8:

- **`forloop`**: `const rows = []` is cached as a constant, and the `push` calls are not seen as mutation.
- **`usectx`**: the `use(Ctx)` result is cached in a branch slot.
- **`bailout`**: an impure statement is cached by its arguments.

### Re-renders and recomputes

Each cell lists the child renders or `costly()` calls on a re-render. A dash means none.

| Case | Uncompiled | React Compiler | forgetti 0.8 |
| --- | --- | --- | --- |
| `derived`: same props | x1, y1 | x1 | - |
| `hook`: same props | x1, y1 | x1, y1 | - |
| `ternary`: inactive branch input changed | Child1 | Child1 | - |
| `map`: one item replaced | Row3 | Row3 | Row1 |
| `map`: item appended | Row4 | Row4 | Row1 |
| `mutate`: `a` changed | Child2 | Child2 | Child1 |
| `jsxprops`: `className` changed | Child2 | - | Child2 |
| `earlyreturn`: `b` changed | body1, Child1 | body1 | body1, Child1 |
| `deepprop`: unrelated prop changed | Child1 | - | Child1 |

Neither compiler wins every row. React Compiler wins where 0.8's outlined JSX regions re-render as a whole. 0.8 wins where its tree cache keeps branch and iteration caches apart.

## Where each approach is not optimal

| Axis | forgetti 0.8 | React Compiler 1.0 | What the rewrite should test |
| --- | --- | --- | --- |
| Unit of caching | Every sub-expression. Too many slots and compares. | Scopes of values made or mutated together. One input change recomputes the whole scope. | Group values by their exact input set, so values with the same inputs share one compare. |
| Mutation | Not tracked, so stale output. | Tracked, and mutated values join one scope. | A local ownership model: a fresh object is mutable until its last mutation and frozen after it. |
| Branches | Child cache per branch. | One scope over all branches. | Keep 0.8's child caches. |
| Loops | Child cache per iteration, keyed by position. | One scope per loop, no per-row cache. | Child cache per iteration, keyed by the JSX `key` or the item when one is known, by position otherwise. |
| JSX | Outlined `memo` components. Extra instances, region-wide re-render. | Cached element values. | Cache element values. Do not outline. |
| What gets cached | Everything, including impure calls. | Not every call result. | Every pure value that is read again. Never `use()`, hook results or impure statements. |
| Rule breaks | Compiled anyway. | Component bails out. | Bail out per component, and report the reason. |
| Cache storage | `useRef` or `useMemo`. | `useMemoCache`. | A forgetti cache hook built on `useRef` or `useState`, never `useMemo`. |

## Questions for the debate

1. Is grouping by input set better than scopes of co-mutated values? Measure slots, compares and recomputes on the corpus.
2. Is a local ownership model enough to make mutation sound? Which corpus cases need alias tracking across function calls?
3. Should the compiler use an IR with a control-flow graph, or stay on the AST? The AST keeps the tree cache close to the source tree. A control-flow graph handles `break`, `continue` and early returns uniformly.
4. Do keyed iteration caches pay for their memory? A list of 1,000 rows holds 1,000 child caches.
5. When should a cheap expression not be cached at all? A slot and a compare cost more than `a + 1`.
6. How does a component signal a bailout to the user: a warning, an error, or an option?
