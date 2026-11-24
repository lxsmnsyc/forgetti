# Review: harness-rc-babel7

Branch `fix/harness-rc-babel7` at `db4f8de`, against `batch/compiler-rewrite`. Checked against `expectations.md`.

## Verdict

Ready to merge. No blocking findings. The claim "more functions compiled, React work unchanged" holds up: the runtime cell loads fresh Babel 7 output, and the counted renders stay the same for reasons visible in the compiled code.

## Evidence

- `pnpm -C <worktree> --filter compare test`: 6 files passed, 3 skipped. 30 tests passed, 6 skipped.
- The diff touches only owned paths and the node folder. Nothing changed in `packages/` or `benchmarks/corpus/`. On the branch, `heldout3` appears only in the brief and in a log line saying it was not opened. I did not open or compile it.
- `diff regate/checks.txt rc-babel7/checks.txt`: only React Compiler gzip and compiled-share lines change (4 summary lines, 14 per-file INFO lines). Every next, forgetti 0.8 and plain number is identical, and so is every React Compiler work number.
- The React Compiler cell gets Babel 7 in both the first compile and the 20 timing runs, because both go through `compileOnce`. forgetti 0.8 still calls `runBabel` with the default Babel 8 core. `lowerJsx` stays on Babel 8 for every cell.
- In the lockfile, `babel-plugin-react-compiler@1.0.0` already depends on `@babel/types` 7.29.14, so the plugin does not pick up Babel 8 types through hoisting.

### Is the work change real? Two heldout2 files

I compiled each file directly with both cores (inline `node -e` with the same options as `runBabel`, and the logger collecting events):

| File | Babel 8 | Babel 7 | `_c(` calls 8 / 7 |
| --- | --- | --- | --- |
| `form_check` | 3 ok, 16 `lowerAssignment ... AssignmentPattern` errors | 6 ok, 0 errors (4 new anonymous `forwardRef` bodies) | 2 / 5 |
| `accordion` | 5 ok, 5 such errors | 10 ok, 0 errors (5 new anonymous bodies) | 4 / 9 |
| `toast_stack` | 5 ok, 1 ref error, 7 `lowerAssignment` errors | 9 ok, only the ref error remains | 4 / 8 |

Then I ran `node src/cli.ts table --set heldout2 --case form_check --case accordion --compiler react-compiler` on the branch. That run rewrites `.out/` from scratch: `writeModule` writes on every run, and the Vite loader is a new SSR server per process, with no cache that outlives it. The run gives `form_check` gzip 3724 and 6/6, and `accordion` 3472 and 10/10, the same as `rc-babel7/checks.txt`. The `.out/.../form_check/input.js` it loads has the 5 `_c(` calls, including `FormCheckLabel` (`_c(14)`) and `FormCheck` (`_c(56)`). The output is not stale and not a mix of the two Babel versions.

Why the counted renders do not move:

- `accordion`: plain work is 4, all of it `c` counts in steps where every cell reports the same value. Every `r` count is already 0 uncompiled. A compiler cannot save anything on this file.
- `form_check`: the count is `bump('Child')` inside `FormCheckLabel`. Compiled `FormCheck` creates the `<FormCheckLabel title label>` element in the same reactive scope as `input`, and that scope (`$[40..47]`) depends on `input`. `input` depends on `props`, the rest object, which is new on every render because `CheckGroup` passes a new `onChange` closure and a new `checked` value. So every time `FormCheck` re-renders, the scope rebuilds the label element, `FormCheckLabel` re-renders and the bump runs. Compiling `FormCheckLabel` does not help either, because the bump is an unconditional side effect in its body. The only saving is the `same` step (3 to 0), which comes from `CheckGroup`, and `CheckGroup` was already compiled under Babel 8. The total stays 38.

## Findings

1. Low. `benchmarks/compare/package.json:25`: `"@babel/core-7": "npm:@babel/core@^7.29.13"` is a caret range, not a pin. The brief asked for a pinned alias. The lockfile fixes 7.29.13, so frozen installs reproduce the numbers. A fresh `pnpm update` could move to a later 7.x and shift React Compiler's results without any visible change. Fix: `npm:@babel/core@7.29.13`.

2. Low, information only. `pnpm-lock.yaml`: `@babel/helper-module-transforms@7.29.14` resolves its `@babel/core` peer to 8.1.3. That helper only runs when a module transform plugin is used, and the harness uses none under Babel 7, so it has no effect today. The rest of the lockfile change is limited to the alias and its own tree (33 added lines).

3. Low, and older than this change. `compilers.ts` `compileOnce` sets `units = compiled + bailouts.length`, and `bailouts` gets one entry per `CompileError` event. Under Babel 8 one function could log several errors (`form_check`: 16 errors from 4 functions). So the `regate` share of 68/132 understated React Compiler twice: through the failures and through an inflated denominator. Under Babel 7 the two numbers almost agree, but a function that logs two errors is still counted twice. Worth a note for whichever node owns the gate's share metric. It does not block this node.

4. Acceptable. `compilers.ts:4-5,26`: the `@ts-expect-error` on the alias import, plus the cast `as unknown as typeof babel`. Babel 7 ships no types, and the only call made through it, `transformSync`, has the same shape. A `declare module '@babel/core-7'` shim would be cleaner but adds a file, and the cast sits in one place. If someone later adds types for the alias, `@ts-expect-error` turns into an error, which is the behaviour you want.

5. Acceptable. `test/fixtures/multifile/typed/chip.tsx:1` and `scale.ts:1`: `// @ts-nocheck`. These files are inputs to the compilers, not harness code. They still contain real TS syntax (`interface ChipProps`, `: number`), so they exercise the preset fix. The worker reports that on base they fail with `The .allExtensions and .isTSX options have been removed`. The `.tsx` sibling has JSX and loads in every cell with 0 differences from plain, so the preset without options still handles JSX in `.tsx`.

6. Minor, test strength. `test/rc-babel7.test.ts`: the destructuring test is strong. It requires no bailouts, `compiled === 1` and `_c(` in the output, which `panicThreshold: 'none'` cannot fake. The "keeps the other compilers" test only checks forgetti's compiled count and does not prove forgetti 0.8 runs on Babel 8. The unchanged forgetti rows in `checks.txt` prove that instead.

## Against expectations

All met, apart from finding 1 (a range instead of a pin). As expected, compiled counts did not move on `base` and `tuning`.
