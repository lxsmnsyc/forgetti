# Adversarial review

A fresh-context reviewer checked contracts, shared files and dependency edges on 2026-11-21. It returned 8 findings, and each was checked against the code before acting.

## Applied

1. Test dependencies had no owner. `contracts` now adds react, react-dom, preact, happy-dom and the vitest DOM setup. `harness` shares `pnpm-lock.yaml` and `.changeset/config.json`.
2. `phase-ir` could not describe branch arms, iteration bodies or `keep` blocks. Added `SlotBlock.kind`, `CacheNode.arm`, `body` and `indexLocal`, an insertion rule for `at`, the nesting and edit-order rule, and a `map` fixture.
3. Offsets are UTF-16 indices, not bytes, verified by the reviewer with `parseSync` on non-ASCII input. `parseSync` returns errors instead of throwing. `preserveParens: false` is fixed in the contract. `api.test.ts` gets a non-ASCII case.
4. `Preset` dropped 0.8's `hocs` and serializable `RawRegExp`. Both are restored, and each `HookType` has its meaning. `phase-ir` gains `Scope`, `Reference.scope` and `closure`, `Binding.scope`, a typed `bindingOf`, and a mutation list with loop handling.
5. No node wired ownership into `compile()`. `contracts` adds a stub `analyzeOwnership()`, and `s1-baseline` calls it. `planner-groups` shares `src/next/index.ts`.
6. `tree-branches` and `tree-loops` rewrite the same tree. `tree-loops` is now `hard` on `tree-branches`, with a nested case in its acceptance. `contracts` fixes the pass order.
7. Unowned shared files. `harness` shares the changesets config. `docs` owns `test/docs/**`. `contracts` narrows the lint exemption to the 0.8 folders, and the fast check runs `pnpm lint`. `switch` owns the 0.8 scratch files.
8. Edge kinds:
   - `emit -> runtime` is now `contract`.
   - Both corpus nodes are `hard` on `harness`.
   - `docs` waits on `final-gate`.

## Rejected

- **Splitting the gate out of `s1-baseline`'s dependencies.** The roadmap runs sequentially (GOAL.md), so the extra edges cost no time. The gate is the node's acceptance, so the node cannot finish without them.

## Precondition

- PR #39 (`chore/repo-setup`) must merge first. This is now in GOAL.md.
