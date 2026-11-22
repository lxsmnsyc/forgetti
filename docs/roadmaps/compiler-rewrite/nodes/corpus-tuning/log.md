# Log: corpus-tuning

- Wrote 19 cases with a generator script outside the repo, then formatted scenarios and meta with oxfmt.
- Uncompiled output differed between targets for throw-once gates and for suspense update. Switched to armed gates, made `discard_suspense_update` React only.
- forgetti 0.8 hung on a mutated resource prop. Switched the suspense cases to `use(res.promise)`.
- Verify command `--set tuning` is rejected by vitest. Added `benchmarks/compare/test/tuning.test.ts`.
- Fast check, compare test, typecheck, build and format check pass.
