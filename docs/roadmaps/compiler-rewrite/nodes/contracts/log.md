# Log: contracts

- Dependencies at latest npm versions on 2026-11-21: oxc-parser 0.159.0, magic-string 1.4.5, react 19.3.1, preact 11.2.0, happy-dom 21.0.4.
- Decision: branch blocks use `at` = the arm, and emit lowers the conditional to statements. The draft said "before the statement", which cannot hold for an arm that runs conditionally.
- Decision: the `keep` output nests inside the later `<ul>` output in the map fixture. The draft said blocks do not overlap, so the contract now allows nesting through a `ValueRef` of kind `output`.
- Dead end: `pnpm format` rewrote `docs/`. Reverted with `git checkout -- docs`.
- Doubt: `useCache` ignores a changed `size` on later renders (hot reload). The `runtime` node may decide.
