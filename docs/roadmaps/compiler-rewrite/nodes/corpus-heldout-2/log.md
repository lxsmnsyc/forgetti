# Log: corpus-heldout-2

- Renamed the branch to `feat/corpus-heldout-2` and reset it to `batch/compiler-rewrite` (740e449).
- No `benchmarks/corpus/heldout2/` existed, so the work was not already done.
- Fetched react-bootstrap v2.10.10, react-restart/hooks (4de925b) and react-hot-toast (e725d38) source with curl into a scratch folder inside the worktree. Deleted it after use.
- Wrote 6 cases. Harness runs used `--compiler plain --compiler react-compiler` only. No `next` or forgetti 0.8 output was produced or opened.
- The first run failed on Preact: the harness has no Preact mapping for `Children` (it maps to `preact`, which has no such export). `form_check` now reads the children array directly.
- One run of `pnpm --filter compare test --set heldout2` was denied by the permission check, then passed on retry. The test file only names `plain`.
- Trimmed `toast_stack` and `toaster_store` under 250 lines. `toaster_store` lost the remove queue so no timer outlives a scenario.
