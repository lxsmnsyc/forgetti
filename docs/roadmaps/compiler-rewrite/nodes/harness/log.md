# Log: harness

- Decision: write the harness in TypeScript, run with Node's type stripping (`node src/cli.ts`), load the new compiler and compiled modules through a Vite SSR server. No build step, and the new compiler runs from source.
- Dead end: `forgetti-0.8` as `npm:forgetti@0.8.5` and as a registry tarball URL both linked to the workspace package. Vendored a `file:` tarball instead.
- Dead end: oxfmt reformatted the corpus inputs and changed React Compiler's bytes. Added ignore patterns in `oxfmt.config.ts`.
- Decision: the debate's 3 forgetti 0.8 differences are 3 files, and one of them (`usectx`) comes from `extra.mjs`. Added `context_change` and `grow_shrink` scenarios to match.
- Decision: the gate checks work and size per target, and compares the compiled share on `heldout` when it is chosen.
- Open doubt: the import specifier of the new runtime is unknown until `emit`. The loader maps any `forgetti` or `forgetti/...` import to `runtime/next.ts`.
- Open doubt: "value log" in the draft contract has no definition. The harness uses HTML plus error.
