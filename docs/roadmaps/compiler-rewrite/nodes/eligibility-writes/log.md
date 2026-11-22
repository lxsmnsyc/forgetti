# Log: eligibility-writes

- Base is `2e69323` (batch/compiler-rewrite). Added the new tests first and ran `pnpm --filter forgetti test test/next/eligibility`: 9 failed, 62 passed.
  - Case 1 (hook results): 4 failing tests (custom hook field write, mutating method in a handler, destructured result, context and memo values).
  - Case 3 (spread copy): 5 failing tests (array copy, nested method, object copy of props, state copy, alias of an element).
  - Case 2 (instance kept in state): the 3 tests pass on base. `store.add(x)` and `store.count = 1` in a handler already bail as `mutates-state`, because `store` is the first element of `useState`. The read-only twin is allowed.
- The contract has no `mutates-hook-result` reason, so case 1 uses `mutates-state`. No change request: the brief says to use it only if the contract has it.
- Case 2 decision: keep bailing. Allowing needs a `phase-ir` change (opaque bindings in the planner). Recorded as a known false bailout.
- Corpus eligibility compared old and new checker over 15 base and 20 tuning files: all 35 identical (only `bailout` bails, `mutates-props`).
- Review found holes in case 3 (slice, concat, Array.from, Object.assign copies, for-of and forEach elements, late assignment, spread of a hook result). Replaced the spread-only rule with the conservative derived rule (see outcome). Added 10 tests. A first version over-bailed `tuning/alias_field`; added per-field safe depth for literals. Corpus: 35 of 35 identical again.
- Second review: wrote one classifier used for initializers, assignments and write-chain roots. Added local-function closure check, reduce accumulator rule, receiver-returning methods and a fresh-result list. Added 6 tests (479 total). Corpus: 35 of 35 identical.
- Third review: stores into locals, call arguments with function bodies, union of local function bodies, shadowed globals. Added 5 tests (484 total). Corpus: 35 of 35 identical.
- Fourth review: classify declarators at every depth, member reads return elements by depth, builtin container reads ignore their arguments, `Map.set` stores the value only, stores through `(g[k] ||= []).push(x)` resolve to the local. Added 4 tests (488 total). Corpus: 35 of 35 identical.
