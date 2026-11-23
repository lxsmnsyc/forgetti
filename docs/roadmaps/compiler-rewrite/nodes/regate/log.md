# Log: regate

- Branch `experiment/regate`, reset to `batch/compiler-rewrite` at `3012731`.
- `gate.ts` rewritten to amendment-1 and committed alone as `9cf2749`, with 6 unit tests in `test/gate.test.ts`. No `heldout2` row was read before that commit.
- Gate output on stderr is noisy (React act warnings, thrown test errors), so `results/regate/save.ts` runs one `collect` and writes `checks.txt` and `table.txt`. It calls the same functions as `cli.ts`. It must run with the compare package as cwd (`pnpm --filter compare exec node results/regate/save.ts ...`). From the repo root the uncompiled cells fail to load, and `sumWork(plain, plain)` recurses without end in `metrics.ts` (not owned, not changed).
- Check run on `base`, `tuning`, `heldout` (saved in `results/regate/pre-heldout2/`): one miss, `tuning/callback_globals` 8 against React Compiler adjusted 3 on React. Everything else passes. Totals: React 374 against 537, Preact 355 against 861, gzip 0.784.
- Full run on all four sets: missed. React total 633 against 723 (pass), 5 files above React Compiler (`callback_globals`, `heldout2/discussions_table`, `form_check`, `toast_stack`, `toaster_store`). On `heldout2` alone React 259 against 186 (miss). Preact, gzip, share and soundness pass everywhere.
- Second run through `save.ts` and one run through the CLI command (`pnpm --silent --filter compare gate ... > file`): gate output identical in all three. Table step counts identical, only compile ms differs.
- On `heldout2`, next equals uncompiled on every step of 7 of 8 files. Read the compiled `next` output of the 4 failing files after the gate to name causes: closures reading `globalThis` in event props, `.map` lists with method calls not cached as a whole, a `columns` array of objects with methods.
- Fast check: forgetti 546 tests pass, compare 15 pass and 4 skip, lint 0 errors, format and typecheck pass.
