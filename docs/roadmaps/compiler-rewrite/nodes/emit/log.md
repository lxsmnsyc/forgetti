# Log: emit

- Branch `feat/emit`, reset to `batch/compiler-rewrite` (363a396). No emit code existed, so nothing was already fulfilled.
- Design: emit walks the AST once for parents and names, then edits with magic-string. Each block's code is computed into its local, then the value and inputs are written.
- magic-string probe: `slice(a, b)` includes `prependRight(a)` and `appendLeft(b)` content, and `overwrite(a, b)` clears both. Emit slices a range before it overwrites it, so inner edits move with the text. Statement code goes in with `appendLeft(statement.start)`, which a slice that starts at the statement does not include.
- Harness slot regex needs an identifier as the first `branch()` argument, so an iteration node declares its rows array as its own local: `const $1r = branch($, 0, 0), $1 = branch($1r, i, 2);`.
- First run: every fixture rendered like the hand output, but raw bytes were 1.22 (ternary) and 1.23 (derived) of hand. The `let` locals cost about 20 bytes per block.
- Switched each output to a read of its value slot (`$[1]`), and the check body to one line. Now 1.06 and 1.05. Multi-output blocks still compute into `const` locals before any write. Filed `contracts/phase-ir.change-request.md`.
- Throw-and-retry: React retries a render that throws on `root.render` inside `act()`. Each case also runs a copy with the inputs written first, and that copy shows a stale value instead of the error, so the tests can fail.
- Test modules go to `test/next/emit/.out/<pid>-<random>/`, one folder per test file, because vitest runs test files at the same time.
- No harness change needed: `useCache(useRef, N)`, `branch($, 0, 0)` and `branch($1r, ++i, 2)` match `SLOT_PATTERNS.next`, and the default runtime specifier is `forgetti/runtime`.
