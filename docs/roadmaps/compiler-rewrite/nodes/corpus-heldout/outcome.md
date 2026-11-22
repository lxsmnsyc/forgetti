# Outcome: corpus-heldout

## Built

The held-out set `benchmarks/corpus/heldout/` has 10 cases. Each is `input.jsx` (97 to 227 lines), `scenarios.js` and `meta.json`, in the corpus-format v1 layout. All run on React 19.3.1 and Preact 11.2.0.

Provenance is in `meta.json`. `"derived": false` means the code is the source's code with light edits, listed in `adaptation`. `"derived": true` means the case was written fresh in the shape of its source. It is not vendored code. The `source` URL and `license` of a derived case name the project it follows.

| Case | derived | Shape | Source (all MIT) |
| --- | --- | --- | --- |
| `hue_slider` | false | draggable slider, memo wrappers, memoized handler tuple, document listeners | omgovich/react-colorful `src/components/common` (`Interactive.tsx`, `Pointer.tsx`, `Hue.tsx`) |
| `hex_input` | false | color text input, local state, `useCallback` handlers, ref event callback, sync effect | omgovich/react-colorful `src/components` (`HexColorInput.tsx`, `ColorInput.tsx`) |
| `otp_input` | false | one-time code input, focus state, ref array, inline handlers, render prop | devfolioco/react-otp-input `src/index.tsx` |
| `table_sort` | true | data table, multi-column sort, enum order, memoized sorted copy | TanStack/table `examples/react/sorting` |
| `dashboard_card` | true | card with money format, sparkline path, changed-value ref hook, sort on a slice | TanStack/table `examples/react/realtime-trading` |
| `form_validation` | true | signup form, validation on every render, touched state | react-hook-form `examples/V7/registerWithErrorMessages.tsx`, `basicValidation.tsx` |
| `list_filters` | true | todo list, reducer, memo item, route filter, footer count | tastejs/todomvc `examples/react/src/todo` |
| `modal_effects` | true | modal with escape and scroll-lock effects, focus restore, ref handler | excalidraw `packages/excalidraw/components/Modal.tsx` |
| `cart_summary` | true | shop with cart reducer, derived total, memo product item | reduxjs/redux `examples/shopping-cart` |
| `tree_view` | true | recursive memo node, per-node open state, reducer over a flat map | reduxjs/redux `examples/tree-view` |

Every `meta.json` has `source` (https URL), `license` (`MIT`), `derived`, `tests` (one line), `adaptation` (what changed from the source) and `targets` (`["react", "preact"]`).

The three `derived: false` cases use only React. They have no counted components, so they add no renders or recomputes to the work totals. They test soundness, size and compiled share.

Also added, outside the owned paths (see Deviations):

- `benchmarks/compare/test/heldout.test.ts`: the acceptance self-check. It is skipped unless the run names the set.
- `benchmarks/compare/src/test.ts` and the `test` script of `benchmarks/compare/package.json`: a wrapper that lets `pnpm --filter compare test --set heldout` and `--set=heldout` run.

The scenarios use `phases()` for one mount plus one update per prop variant, and a stateful scenario per case. Most stateful scenarios call setters that the component stores on `globalThis` in an effect. The three `derived: false` cases need no such effect. Their scenarios dispatch DOM events at the rendered elements. They use a `wrap` that puts a ref on a wrapper div, because the harness container is detached from `document`.

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- Seven cases (`derived: true`) are fresh rewrites in the shape of their source. Their upstream examples import libraries the harness does not install (`@tanstack/react-table`, `react-hook-form`, `react-redux`, `react-router-dom`, `@excalidraw/common`, `classnames`) and are mostly under 100 lines. Same state, handlers and render structure, with library hooks replaced by local state, props and `useReducer`. No source text is copied unchanged.
- Three cases (`derived: false`) are the source code with light edits: types removed, files joined, `React.x` rewritten as named imports (the harness rewrites only the named import form for Preact), and some comments dropped in `hue_slider`. `otp_input` also gains an exported `OtpField` that supplies the render props. Nothing was added to probe a compiler.
- `benchmarks/compare/test/heldout.test.ts` is new and `benchmarks/compare/src/test.ts` is new. The `test` script changes from `vitest run` to `node src/test.ts`. Reason: the brief's `verify` is `pnpm --filter compare test --set heldout`, and vitest 5 fails on the unknown option `--set`. The wrapper removes `--set <names>`, sets `COMPARE_SETS` and runs `vitest run` with the other arguments. Without `--set heldout` the two heldout tests are skipped, so other nodes' runs do not read the set. Other test files are unchanged.
- The cross-target HTML check in `heldout.test.ts` normalizes runtime differences before comparing React with Preact. React writes the `checked` and `value` attributes of controlled inputs and Preact sets only the properties. This is stripped on `input` and `textarea` tags only. Preact also drops an empty `class`, and attribute order differs. Other tags keep every attribute, so `option` elements must not rely on `value` (`form_validation` uses `<option>{t}</option>`). The tuning test compares raw HTML because its cases avoid controlled inputs. Controlled checkboxes and inputs are part of real forms, so the cases keep them. The `gate` check compares each compiler with uncompiled output on the same target, so it is not affected.
- The corpus-format contract does not list an `adaptation` field. The harness ignores unknown meta fields.

## Stubs left

- None. The set runs on uncompiled output only, as the brief requires. Forgetti and React Compiler were not run on it.

## Gotchas

- `final-gate` runs `pnpm --filter compare gate --set heldout`. The compiled share threshold is computed on `heldout` cases when `heldout` is chosen. Compiled units are counted per component or hook. The unit total was not counted here.
- Several cases write a ref during render (`modal_effects` `useEscape`, and `useEventCallback` in `hue_slider` and `hex_input`, as the source does), mutate a slice they copied (`dashboard_card`), or call handlers from props inside effects (`hex_input`). A compiler that is unsound on these shows as a difference, not as a crash.
- `modal_effects` listens on `document` and toggles a class on `document.body`. Counters live in module state (`lock`). The module is loaded once per compiler and target, so cases do not share it.
- The scenario setters on `globalThis` are overwritten by each mount. The harness runs scenarios one at a time.
- `phases()` takes a props factory as `base` for `dashboard_card`, because the component sorts a copy of `quotes` and the data must not be shared.
- Uncompiled React and Preact differ in `checked` and `value` attribute output. Do not compare raw HTML across targets on this set.
- `otp_input` has a controlled `value` prop and a no-op `onChange`, so typing steps do not change its HTML. Only its focus state and handlers run.
- Do not format `input.jsx` files (`oxfmt` ignores them). `scenarios.js`, `meta.json` and the test files are formatted.

## Proposed learnings

- Compare HTML across React and Preact only after normalizing `checked` and `value` on `input` and `textarea`, empty `class` and attribute order | Controlled inputs serialize differently on the two targets | benchmarks/compare/test | yes

## Verification

- `pnpm --filter compare test --set heldout` and `--set=heldout`: pass, 13 tests (2 in `heldout.test.ts`: 10 or more cases, 100 to 250 lines, https source, allowed license; no errors and the same normalized HTML on React and Preact).
- `pnpm --filter compare test`: pass, 11 passed and 2 skipped.
- `pnpm --filter compare table --set heldout --compiler plain`: 10 cases on both targets, no step errors.
- `pnpm --filter compare typecheck`: pass.
- `pnpm format:check`: pass.
- `pnpm --filter forgetti test`: pass, 448 tests.
- `rtk proxy pnpm lint`: warnings only, no errors.

## Size

- Estimated M, actual M.
