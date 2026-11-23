# Outcome: corpus-heldout-3

## Built

`benchmarks/corpus/heldout3/` has 8 cases from 7 repositories. 7 are multi-file (siblings flat in the case folder, as `harness-multifile` describes) and 1 is single-file. All run on React 19 and Preact 11. All are `derived: false`: vendored code with types and docs removed, plus stand-ins for packages the harness lacks, as listed in each `adaptation`.

The sources were chosen and committed in `log.md` (commit `2929b9e`) before any case was built. None of the repositories appears in base, tuning, heldout or heldout2. Licenses were read from the GitHub API.

| Case | Repository | Commit | Paths | License | Files |
| --- | --- | --- | --- | --- | --- |
| `clock` | wojtekmaj/react-clock | 82fcaefa788d6d5cbde839d12736a4edb92be362 | `packages/react-clock/src/Clock.tsx`, `Hand.tsx`, `Mark.tsx`, `MarkNumber.tsx`, `shared/hourFormatter.ts`, `shared/utils.ts` | MIT | 6 modules |
| `year_view` | wojtekmaj/react-calendar | 1e423045a85a226f29332d019448427dd7c1c334 | `packages/react-calendar/src/YearView.tsx`, `YearView/Months.tsx`, `YearView/Month.tsx`, `Tile.tsx`, `TileGroup.tsx`, `Flex.tsx`, `shared/utils.ts`, `shared/dateFormatter.ts`, `shared/dates.ts` | MIT | 8 modules |
| `rate` | react-component/rate | 78030fa08ff6a626ed0079ed79ad5e475931cef9 | `src/Rate.tsx`, `src/Star.tsx`, `src/useRefs.ts`, `src/util.ts` | MIT | 4 modules |
| `steps` | react-component/steps | d1060e22f700db45f223dab3622962e989408198 | `src/Steps.tsx`, `src/Step.tsx`, `src/StepIcon.tsx`, `src/Rail.tsx`, `src/Context.ts`, `src/UnstableContext.ts` | MIT | 7 modules |
| `switch` | react-component/switch | dd99fb19dfd14eb97cb20839b3592ca0ed419500 | `src/index.tsx` | MIT | 1 module |
| `progress` | react-component/progress | 8efdfd5b5fda84c5030f284c2c1ec2da0a1dd25e | `src/Circle/index.tsx`, `src/Circle/PtgCircle.tsx`, `src/Circle/util.ts`, `src/common.ts`, `src/utils/getIndeterminateCircle.tsx` | MIT | 6 modules |
| `product_page` | vercel/commerce (app) | f7521d57d29f0eb3d23c1399cf9bb299d61fcd21 | `components/product/product-description.tsx`, `components/product/variant-selector.tsx`, `components/cart/add-to-cart.tsx`, `components/cart/cart-context.tsx`, `components/cart/open-cart.tsx`, `components/price.tsx`, `components/prose.tsx` | MIT | 8 modules |
| `search_filter` | vercel/commerce (app) | f7521d57d29f0eb3d23c1399cf9bb299d61fcd21 | `components/layout/search/filter/index.tsx`, `dropdown.tsx`, `item.tsx`, `lib/utils.ts` (`createUrl`) | MIT | 5 modules |

Each case has a harness entry component that holds state, exposes setters (and for most a root element, for DOM events) on `globalThis`, and computes one value through a counted helper (`describeTime`, `describeScore`, `countDone`, `countEnabled`, `sumPercent`, `describeValue`, `findSelectedVariant`, `describeQuery`). Child renders are counted with `bump('Row')`, `bump('Child')` or `bump('Btn')` in upstream leaf components, which are the only keys that count as renders (`RENDER_KEYS`). Scenarios have a `same` step, prop variants (some with equal content in new arrays), state steps through the setters, DOM click, keydown and submit events dispatched on rendered elements, and a context step in `steps`.

Also added, outside the owned path (see Deviations): `benchmarks/compare/test/heldout3.test.ts`.

SHA-256 of every file in the set (`shasum -a 256`, after formatting):

```
348c88c3321f87232aea71e7b2b55934b9ad44888513226a768ff613e6f638ba  benchmarks/corpus/heldout3/clock/meta.json
9e81b492b1e4d8815a540d066ac1c5db257b1beacb8970f1a3acef2f4e52d2bd  benchmarks/corpus/heldout3/clock/hand.jsx
0da7f4044071c9e4313936a31e2bb4afda81b0608dd759599ff35bc932567168  benchmarks/corpus/heldout3/clock/hour_formatter.js
4337cb4a5dcdbe4dca81a664773be7e385d9f4dce88a1e8b035a8fb242a1a8d8  benchmarks/corpus/heldout3/clock/input.jsx
e5cb06108dd583a0fe6fb3b20e4d79311df5e422cc0cc541a06a8bce66829ac0  benchmarks/corpus/heldout3/clock/mark.jsx
1f2b2fc591429cea494c5d1779fafa89f64e3322af8d99fcbb4e496a74fd324f  benchmarks/corpus/heldout3/clock/mark_number.jsx
8d927f335aeb0a0233fccd906ec3537ef5232b511524216f358d7de9cdc1e51c  benchmarks/corpus/heldout3/clock/scenarios.js
d26cce224e618f362194c8f8408f6bb2aa577b3acdf29fcc016bb36b6d3e359f  benchmarks/corpus/heldout3/clock/utils.js
7e58f967b1a199d5bc604317072f14c10bbc46d8f72379113cf27057fa218ad0  benchmarks/corpus/heldout3/product_page/add_to_cart.jsx
4dcfcf042b834908e519f108e1b3c59f5394d8f69872d649d78f2ec57e4d5e6b  benchmarks/corpus/heldout3/product_page/cart_context.jsx
9f9cfd3491575b787bd8d8f0fe4e62d73df66f859032a8275c4bf3b9ad55e288  benchmarks/corpus/heldout3/product_page/input.jsx
cd29cb0c4b546e658e98ac2a71efa5e25d54ae26ef7e8157fba91a78df20c48c  benchmarks/corpus/heldout3/product_page/meta.json
f094b279c9f0528b3c88dca15daab741e443cd22044f32a858bdab5c89f40214  benchmarks/corpus/heldout3/product_page/navigation.jsx
e84bd1504d8de95d9bcf6499e466009e261477b5128a2889654853a2a08b4ef7  benchmarks/corpus/heldout3/product_page/price.jsx
44d7ace2c739b52e74459d38264c2a4616e1e4c84ea50938cd02fb4822e9d5d1  benchmarks/corpus/heldout3/product_page/prose.jsx
851542f5de57f8611973b56580141b6bb2326437846c27f5cf8aa6eaaf123c23  benchmarks/corpus/heldout3/product_page/scenarios.js
433657075208288cfef046eb2c61aacac649ebc5aeb12a0ee2fd85c3fb1de969  benchmarks/corpus/heldout3/product_page/util.jsx
91c9d3b06afdd16ec1613d981685cfc14e372603fb71861f856837bd5f8b9e4b  benchmarks/corpus/heldout3/product_page/variant_selector.jsx
72fd99b444f6d56f9c3c0a210dd720a7d5d8a012063bebbcffbf7cc954008bb1  benchmarks/corpus/heldout3/progress/circle_util.js
4c9a594edb12bedf93d5426bebbd8d537d3f1d6e488efe2049bb4fc4aab3cb2a  benchmarks/corpus/heldout3/progress/common.js
1545fda6dd4e3ca071dc49bb0c8c1b48028692832afc7f8778c387ad9483f8c6  benchmarks/corpus/heldout3/progress/indeterminate_circle.jsx
cf693d871afabaf926a3e80e8be171878018515ef7b470ac1098eb05a44b3a09  benchmarks/corpus/heldout3/progress/input.jsx
50669b3b823f54f1d799f16005c543812e7642bdddfee6fd7dfcdcbb3569d52d  benchmarks/corpus/heldout3/progress/meta.json
c5ba5681486913fbefe6ae7f18b2d15dae655238407bb37628c8f8e50f837650  benchmarks/corpus/heldout3/progress/ptg_circle.jsx
c7f9d7585981626b3d6e0ea7f25a375ac1bb31e0f2610db111c660eb1cc7ff74  benchmarks/corpus/heldout3/progress/scenarios.js
15f355f5edf3154c5e8e37da77fe5c0e7b6cb0b63ea5487cf2719a400de36aa1  benchmarks/corpus/heldout3/progress/util.js
55b25f27631bfb5f664802eb6b58182ac43540d8154cd69d7a988286dd2e2e0c  benchmarks/corpus/heldout3/rate/input.jsx
8a60cc45326019f12d7a552eee084388ddcfaa89678a0e666ff7c54b00b9d901  benchmarks/corpus/heldout3/rate/meta.json
cb5c08f9df8506e8a178a89c87cbbe85efd8f42ec74b191a98cdd830b674935d  benchmarks/corpus/heldout3/rate/scenarios.js
e3cfde6d336f05c6ed8ef8cb0a6f92a35d0fad80d224fd5565c14258a51d04fe  benchmarks/corpus/heldout3/rate/star.jsx
9a1983f021223dbbb6ddc81713cb7a47cafea472013bad6672373d7a1fdca85a  benchmarks/corpus/heldout3/rate/use_refs.js
69cbf648a1843459135c14be2fad57bafe63e66804a8af65b1d84944ce0eb4c4  benchmarks/corpus/heldout3/rate/util.js
21c1d7a4c967c175e555566a71cea8d6a3c3d4bf4a4e3aaf46cb35f861dfee3f  benchmarks/corpus/heldout3/search_filter/dropdown.jsx
e9175035eca3f115cf8420cd850198d48b5b8cddc219aba9b157ced4ad1295e8  benchmarks/corpus/heldout3/search_filter/input.jsx
d88d3cf1f86b77dd6599a2477ec79f893b70ae5e9d5ce1c7c66cd5edc8ff7c31  benchmarks/corpus/heldout3/search_filter/item.jsx
9b4cdda424d14c92fa1a2e51eba8dcca14b66f4dd404e1ae3b7dcb74d4fec1c5  benchmarks/corpus/heldout3/search_filter/meta.json
390dc2bc40d73b33c00fb8a0a951f3c5cf8b2ff822b73b764676ba6285cc020c  benchmarks/corpus/heldout3/search_filter/navigation.jsx
26950e00a98615c9902b81aec23583b9a11bc46909dc6b758fd0469d2cd08a02  benchmarks/corpus/heldout3/search_filter/scenarios.js
f7efb565c29eae72468a31f9cae8a0484c7b4be682c932b2b90490947c6c84fb  benchmarks/corpus/heldout3/search_filter/util.jsx
e3f6de05357f12e69a559bd7f24d37e48ac5a98d991b45398ebd5a0e67ddb9aa  benchmarks/corpus/heldout3/steps/context.js
d3c2bf5c49315c6bd245b651e1cd83202d2111cfda5dd716908df92e6e6dc697  benchmarks/corpus/heldout3/steps/input.jsx
1758f3a5f0eecb3015e99d1c33d6be5a696c6a4b0964f6c28f56bbd2c47a850c  benchmarks/corpus/heldout3/steps/meta.json
23212a02686cf1f84d158135dd0c17a6cd151e9e26ef34b37391609caed8c64a  benchmarks/corpus/heldout3/steps/rail.jsx
6c38d6229bbc57dc744ac2d365f4df6de01f3dd91dd2bb957c870897eef0719b  benchmarks/corpus/heldout3/steps/scenarios.js
2368c50884846fa9c2b1373568e06fb77e74d518d44242409b9fe3a864d09e5e  benchmarks/corpus/heldout3/steps/step.jsx
3290c82273424466064a8ed0a554704bceb2d2b3d430141722b9b0751abd2603  benchmarks/corpus/heldout3/steps/step_icon.jsx
842535cf4fd033e14f4c36c09d5a611d5c312801940200134a0bbc0b37ba9959  benchmarks/corpus/heldout3/steps/unstable_context.js
4c466708baa4e8a8af1b446fb74097ecac1ead27e1004c61d340b2892714b51a  benchmarks/corpus/heldout3/steps/util.js
13e4805f5b65ef2ad7c1d02bd4e4fc7e5c2c4e6bce371f73740547fa158005cb  benchmarks/corpus/heldout3/switch/input.jsx
4b756e77076cfc5f50003c5230bd5cc57b9d0492d73dacce0161705ee22dfa45  benchmarks/corpus/heldout3/switch/meta.json
60f7e464985fd35bccd3b47cd13a7e00ee8710f725160f0f9fff8c6c7e8b02ac  benchmarks/corpus/heldout3/switch/scenarios.js
dbea0da0af504901b22a11c3fd46c0844700637adedbe095a572075f9c76ed30  benchmarks/corpus/heldout3/year_view/month.jsx
c82c0dcdad73913cf70302831677c030c058bee42df5bb1ce7c1a895f016264c  benchmarks/corpus/heldout3/year_view/date_formatter.js
527042dbc37faabf5d393fafa067a3fbfa88217c0fcfbf34b5ce467de9f800d9  benchmarks/corpus/heldout3/year_view/dates.js
606ee161489d351664c379a83f413f0a3b7c32f7998aeaeb6c5a965a438383d7  benchmarks/corpus/heldout3/year_view/flex.jsx
a95c2b5015009c09bb67f7ccff748cb9268446c4a3ce7f48cdef78f830c702f3  benchmarks/corpus/heldout3/year_view/input.jsx
d0517769e6ffc922985372d14adc7feba1ab9b44e5eb4df883510e64fc202674  benchmarks/corpus/heldout3/year_view/meta.json
dd3ab58b98045c12a6d894a709be33f12c5bb9438c1b566bc3f0caae70db422d  benchmarks/corpus/heldout3/year_view/scenarios.js
03302d07537fe44f2b9a52b9721eafb17815a09b760847769c519b606ff4b561  benchmarks/corpus/heldout3/year_view/tile.jsx
c63b08c9cf1f2ecc22b2c670a7f23cecd8abe186148dd2916e081d700185449f  benchmarks/corpus/heldout3/year_view/tile_group.jsx
bacd11230829f519d9225f4f38b0cd16db90952100519580c789279ec047ab1f  benchmarks/corpus/heldout3/year_view/utils.js
```

## Proof

Not a fix node.

## Result

Not an experiment node. Work totals are child renders plus recomputes over all steps except mounts, printed by `nodes/corpus-heldout-3/scratch/totals.ts` (`collect` with `plain` and `react-compiler` only, then `sumWork` and `findDifferences`). Compiled is React Compiler's compiled functions over all functions it reported.

| Case | plain, React | plain, Preact | React Compiler, React | RC differences | RC compiled |
| --- | --- | --- | --- | --- | --- |
| `clock` | 117 | 117 | 117 | 0 | 1/26 |
| `product_page` | 29 | 29 | 12 | 0 | 13/17 |
| `progress` | 24 | 24 | 24 | 0 | 4/8 |
| `rate` | 88 | 88 | 73 | 0 | 4/14 |
| `search_filter` | 61 | 61 | 42 | 0 | 11/11 |
| `steps` | 113 | 113 | 105 | 0 | 3/17 |
| `switch` | 32 | 32 | 14 | 0 | 3/6 |
| `year_view` | 186 | 186 | 174 | 0 | 5/10 |
| Total | 650 | 650 | 561 | 0 | |

Differences from uncompiled output: React Compiler on React, 0 steps in 8 cases (HTML and errors compared on every step including mounts). Plain gives the same normalized HTML on React and Preact for every step.

## Deviations

- `benchmarks/compare/test/heldout3.test.ts` is new, outside the owned path. It copies `heldout2.test.ts` with the set name changed. It is skipped unless `COMPARE_SETS` names `heldout3`. Its size rule counts the input plus siblings (100 to 600 lines; `product_page` has 534) and it checks 8 to 10 cases, 5 or more repositories and at least half multi-file. Its HTML normalization adds two Preact serialization differences seen in this set: Preact writes `suppressHydrationWarning` as an attribute (commerce `Price`), and writes a zero style length as `0px` where React writes `0` (react-calendar `Flex`). No change to `benchmarks/compare/src/` was made.
- The brief says the source list is chosen before building. Two changes came after the list was committed, both logged: react-tabs was dropped (its Tabs walk children with `Children` and `cloneElement` by element type, and the harness maps `Children` to Preact core, which has no such export), and vercel/commerce gives two cases. 8 cases from 7 repositories.
- All upstream code is TypeScript; the cases are `.jsx` and `.js` with types removed, as in heldout2. A `.tsx` sibling fails to load in every cell (see Gotchas).
- React namespace calls (`React.useRef`, `React.forwardRef`) became named imports in the rc-* cases, because `retarget` rewrites named imports from `react` only.
- React 19 features that Preact lacks are replaced in `product_page`: `formAction` functions, form `action`, `useActionState`, `use(promise)` and `useOptimistic` (listed in its `adaptation`).
- `Price` was an arrow function with an expression body; it now has a block body so it can call `bump('Child')`.

## Stubs left

- None.

## Gotchas

- A `.tsx` or `.ts` sibling fails every cell: `lowerJsx` in `benchmarks/compare/src/compilers.ts` passes `isTSX` and `allExtensions` to `@babel/preset-typescript`, and Babel 8 throws "The .allExtensions and .isTSX options have been removed". No corpus case had a TypeScript file before, so it never showed. `harness-multifile` says `.ts` siblings work; they do not.
- React Compiler 1.0 under the harness's Babel 8 reports a CompileError on many plain constructs here: "Expected object property value to be an LVal, got: AssignmentPattern" on every object pattern with a default (`({ a = 1 })`, `const { x = 'div' } = props`), "Expected Identifier, got TemplateLiteral key in ObjectExpression" on computed keys such as `` [`${prefixCls}-checked`]: on ``, and "Expected Identifier, got CallExpression key" on `[option.name.toLowerCase()]`. Upstream components use these everywhere, so React Compiler compiles few of the main components (`clock` 1 of 26 functions, `steps` 3 of 17). These look like Babel 8 AST changes React Compiler 1.0 does not read, not real bailouts. heldout2 shows the same error on `BaseNav` and `ListGroup` in `list_group` (both destructure with a default). A gate that compares against React Compiler on this set measures a React Compiler that skips most library components.
- `heldout3` scenarios dispatch DOM events on elements reached through refs exposed on `globalThis`. A compiler that changes when those effects run changes which element the scenario finds.
- `progress` uses a module-level id counter in `useId` so React and Preact print the same ids. The ids depend on mount order across scenarios.
- `src/gate.ts` names `heldout2` as `CLEAN_SET`. A gate on heldout3 needs that changed.
- Do not run `gate`, `table` or `test` for `heldout3` with `next` or `forgetti-0.8` before its gate. `table --set heldout3` without `--compiler` runs all four. `pnpm --filter compare test --set heldout3` is safe: the test names `plain` only.
- Input files are not formatted by `oxfmt`; siblings, `scenarios.js` and `meta.json` are. Formatting a sibling changes its bytes and its SHA-256 above.

## Proposed learnings

- Use `Child`, `Row` or `Btn` as the counter key for a child render | any other key counts as a recompute in `RENDER_KEYS` | benchmarks/corpus | yes
- Keep corpus modules in `.jsx` and `.js` until `lowerJsx` drops the Babel 7 preset options | a `.tsx` sibling fails every cell under Babel 8 | benchmarks/compare | yes

## Verification

- `pnpm --filter compare test --set heldout3`: pass, 27 passed and 4 skipped (the 2 new heldout3 tests pass).
- `pnpm --filter compare test`: pass, 25 passed and 6 skipped (heldout3 skipped).
- `pnpm --filter compare typecheck`: pass.
- `pnpm format:check`: pass.
- Totals script through `pnpm --filter compare exec node`, plain and React Compiler only: 8 cases, 0 differences.
- `pnpm --filter compare table --set heldout3 --compiler plain --compiler react-compiler` per case while building.
- No `next` or forgetti 0.8 output was produced, run or seen for this set.

## Size

- Estimated L, actual L.

## Orchestrator notes

- `scratch/rc-events.mjs` was removed at landing (review should-fix): it ran React Compiler on `heldout3` outside the harness. Its finding stays above: under the harness's Babel 8, React Compiler compiles 1 of 26 functions in `clock` and 3 of 17 in `steps`. `harness-rc-babel7` fixes the Babel version.
