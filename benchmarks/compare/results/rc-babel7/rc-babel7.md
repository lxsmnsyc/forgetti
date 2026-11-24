# React Compiler under Babel 7

The `react-compiler` cell now compiles through `@babel/core` 7.29.13 (alias `@babel/core-7`). The other cells still use Babel 8. Files: `rc-babel7/checks.txt` and `rc-babel7/table.txt`. Compared with `regate/`, same sets (`base`, `tuning`, `heldout`, `heldout2`; 62 files), same commit base `70fd34b`, command `pnpm --filter compare exec node results/regate/save.ts results/rc-babel7 base tuning heldout heldout2` (exit 1, the regate misses, as before).

## What changed

| Number                                           | `regate` (Babel 8)    | `rc-babel7`                                        |
| ------------------------------------------------ | --------------------- | -------------------------------------------------- |
| React Compiler React work, all sets (adjusted)   | 723                   | 723                                                |
| React Compiler React work, `heldout2` (adjusted) | 186                   | 186                                                |
| Functions compiled, `heldout` and `heldout2`     | 68 of 132             | 91 of 103 (fewer failed functions, so fewer units) |
| Compiled share, `heldout2`                       | 49/94 (0.521)         | 67/70 (0.957)                                      |
| Total gzip, all sets (next / React Compiler)     | 57875 / 71947 = 0.804 | 57875 / 77972 = 0.742                              |
| Total gzip, `heldout2`                           | 20659 / 24489 = 0.844 | 20659 / 29302 = 0.705                              |

- React work does not change in any file, so the gate misses and passes are the same.
- Compiled share on held-out files: next 97/101 (0.960) against React Compiler 91/103 (0.883). The threshold still passes, now by a smaller margin. On `heldout2` alone next and React Compiler are level, 67/70 (0.957). The share is no longer a sizable lead for next.
- Gzip: React Compiler's output is larger because more functions are compiled. The ratio falls from 0.804 to 0.742 (all sets) and from 0.844 to 0.705 (`heldout2`). The worst file ratio is not above the 1.15 limit on either selection.

## Thresholds

No threshold changes between pass and miss.

| Threshold                                    | All sets                  | `heldout2`                |
| -------------------------------------------- | ------------------------- | ------------------------- |
| 0 differences, React and Preact              | pass                      | pass                      |
| React total work below React Compiler        | pass, 633 against 723     | miss, 259 against 186     |
| React, no file above React Compiler          | miss, 5 files             | miss, 4 files             |
| Preact total work below uncompiled           | pass, 611 against 1128    | pass, 256 against 267     |
| Preact, no file above uncompiled             | pass                      | pass                      |
| Total gzip at most 1.0 times React Compiler  | pass, 0.742               | pass, 0.705               |
| No file above 1.15 times React Compiler gzip | pass                      | pass                      |
| Compiled share on held-out files             | pass, 0.960 against 0.883 | pass, 0.957 against 0.957 |

The five files above React Compiler are the same: `tuning/callback_globals` 8 against 3, and `heldout2` `discussions_table` 64 against 22, `form_check` 41 against 38, `toast_stack` 27 against 21, `toaster_store` 74 against 45.

## Unchanged rows

`diff regate/checks.txt rc-babel7/checks.txt` shows changes only in the lines with React Compiler gzip or compiled share. The total-work lines and every per-file work number of next, plain and forgetti 0.8 are equal, and so are the forgetti 0.8 wrong-step and below-next lists. The differences table (`next` 0 steps, `forgetti-0.8` 84 steps in 19 files on React and 87 in 18 on Preact) is equal.

## Is React Compiler sound under Babel 7

Yes, with the same single file as before. The differences table reads `react-compiler | react | 6 steps | 1 file`. The file is `tuning/callback_globals` (the six `GlobalMap`, `GlobalMemo`, `GlobalPlain` steps `again` and `clear_global`, replaced by uncompiled counts in the gate). Every other file, including all of `heldout` and `heldout2`, has 0 differences from uncompiled output. React Compiler stays unsound only there.

## Why the work is unchanged

The extra functions React Compiler now compiles do not lower the scenarios' work: the compiled count, size and share moved, the step counts did not. This was measured, not traced to a cause. So the React work target is the same as the regate measured, and the `heldout2` miss (259 against 186) is not caused by the Babel 8 failures.
