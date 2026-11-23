# Expectations: corpus-heldout-3

Written by the reviewer before seeing the change. Read from `GOAL.md`, the roadmap `CLAUDE.md`, this node's `brief.md`, `nodes/harness-multifile/outcome.md`, `nodes/corpus-heldout-2/outcome.md` and `benchmarks/corpus/heldout2/toast_stack/` as the format reference.

## What a good sealed set satisfies

### Size and layout

- 8 to 10 case folders under `benchmarks/corpus/heldout3/`, each a flat folder with `input.jsx` or `input.tsx`, `meta.json` and `scenarios.js`.
- At least half the cases (4 of 8, 5 of 9 or 10) are multi-file: siblings next to the input, no sub-folders.
- Sibling names follow the harness rules. No `input.*` or `counter.*` siblings, no pair that differs only in extension, imports start with `./`.
- Every file imports the counter as `../shared/counter.js` or `../../shared/counter.js`, so input and siblings count into one counter.
- Nothing outside `benchmarks/corpus/heldout3/**` changes, except a test file in `benchmarks/compare/test/` that copies `heldout2.test.ts` with the set name changed. Any such deviation is listed in `outcome.md`.

### Sources

- Each case comes from an MIT-licensed repository that no earlier set uses (`base`, `tuning`, `heldout`, `heldout2`). react-bootstrap, react-restart/hooks, react-hot-toast, nextjs-subscription-payments and bulletproof-react are already used and are out. I will check the other sets' `meta.json` sources for overlap.
- `meta.json` gives the source URL, the license, a tag or full commit SHA and an `adaptation` field that lists every edit.
- The license is checked at the cited commit, not assumed.
- The code is near verbatim. Removed types, propTypes and docs are fine. Replaced dependencies are fine if they are small local versions with the same behavior and the `adaptation` lists them. Logic in the component bodies keeps its upstream shape: same hooks, same dependency arrays, same inline closures and object literals, same JSX structure.
- Real-shaped: components a library or app ships, with context, refs, effects, memo and callbacks as upstream has them. A harness entry component is allowed and named as new in `adaptation`.
- Line counts sit in the 100 to 250 range used by `heldout2`, summed over all files of a case or checked per the test's own rule.

### Multi-file split

- The split matches the upstream module split. A component and its hooks or child components that live in separate upstream files are separate siblings here. Files that upstream keeps together are not split to create cross-file edges.
- Each sibling names the upstream file it comes from (comment or `adaptation`).
- `input.*` exports only what scenarios name, and re-exports any context or component from a sibling that a scenario needs.
- `scenarios.js` imports only `../../shared/scenarios.js` or similar shared helpers. It never imports a sibling or the input.

### Scenarios

- Every case has a `same` step (equal props, new identity where the props hold arrays or objects), at least one prop change and at least one state change (through a setter on `globalThis`, an exported store `dispatch`, or an `act`).
- Context steps exist where the case reads a context.
- Each step changes something a compiler could skip or not skip. A scenario whose every step re-renders nothing in plain output measures nothing.
- Child renders are counted by `bump('<name>')` in leaf or memo components that receive props from the measured parent, so caching a child element or prop changes the count.
- Recomputes are counted by a helper that calls `bump` and returns the value it computes, and that value is used in the render output. No bare `bump` statement inside a memo callback or a hook body (React Compiler hoists those).
- Counters sit where upstream does real work (filtering, formatting, deriving lists). They are not placed only inside code that one compiler is known to cache or not cache.

### Determinism and soundness

- No real clock, randomness or layout reads that change output between runs. Timers use long durations or fixed inputs, as `toaster_store` did.
- Module state, if any, is reset by the entry on first render, so case order does not matter.
- `pnpm --filter compare test --set heldout3` passes. Plain runs without `--set` skip the set.
- Plain and React Compiler give 0 differences in HTML and errors on every step, mounts included. Plain gives the same normalized HTML on React and Preact.
- Two runs give the same work totals.

### Provenance and sealing

- `outcome.md` lists each source (repo, commit, path, license) and a SHA-256 of every file in `benchmarks/corpus/heldout3/`. I will recompute the hashes and compare all of them, and check that no file is missing from the list or extra in it.
- `log.md` lists the chosen sources before any case was built (the brief requires this order).
- Every harness command in `log.md` and `outcome.md` names `--compiler plain --compiler react-compiler`. No `gate`, `table` or default-compiler run on `heldout3`.
- No `next` or forgetti 0.8 output for `heldout3` exists in the branch, in `results/` or in any committed log.
- The worker did not read `debate-2/`, planner outcomes, `benchmarks/compare/results/` or `packages/forgetti/src/` (checked from `log.md`).

## Failure modes I will hunt

- **Dead scenarios.** Steps that change nothing, or a `same` step that is the only step. Totals per case where plain counts 0 or near 0 work.
- **Biased counters.** `bump` placed so one compiler gains or loses by construction: a bare `bump` in a memo callback, a recompute helper whose result is unused, counters only in components that are already `memo` upstream, or only in places a whole-component cache skips.
- **Mangled inputs.** Upstream code rewritten so its hooks, closures or dependency arrays differ from the source, with no entry in `adaptation`. I will diff a sample of files against the cited commit.
- **Fake splits.** Siblings that do not match the upstream file boundaries, or single-file upstream code cut into pieces to inflate the multi-file count.
- **Siblings in scenarios.** `scenarios.js` importing a sibling or the input, which bypasses the compiler under test.
- **Reused or unlicensed sources.** A repository used by an earlier set, a license that is not MIT at the cited commit, or a commit that does not contain the cited path.
- **Wrong hashes.** Any SHA-256 in `outcome.md` that does not match the file, or files missing from the list.
- **Weakened tests.** Changes to `heldout.test.ts`, `heldout2.test.ts`, other sets or `benchmarks/compare/src/` that relax a check, lower a minimum, or change how other sets run. Any change to an existing set's files.
- **Nondeterminism.** `Date.now`, `Math.random`, real timers that can fire during a run, or module state that leaks between scenarios.
- **Seal leaks.** Any trace of `next` or forgetti 0.8 being run or shown for `heldout3`.
- **Soundness gaps.** Errors in any cell, steps excluded from comparison, or a case dropped from the React Compiler run without a note.
