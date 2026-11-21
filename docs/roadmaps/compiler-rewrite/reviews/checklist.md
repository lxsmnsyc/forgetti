# Checklist

- **Data and migrations**: N/A. No stored data. Compiled output is rebuilt on every build.
- **Compatibility**: `switch`. The Babel plugin entry and the `$$cache`/`$$branch`/`$$memo` runtime exports are removed. This is a breaking change, and its changeset level waits on the maintainer (GOAL.md open question). The vite and rollup plugin option names stay the same.
- **Auth and permissions**: N/A. A build-time library.
- **Failure modes**: `eligibility` and `compiler-api`. A unit that cannot be compiled is left unchanged with a diagnostic. A syntax error throws with the oxc offset. The runtime write rule covers a throw during render (`runtime`, `emit`).
- **Concurrency**: `runtime`. Interrupted transitions, Suspense and StrictMode come from proof T1. There is no shared state across components.
- **Limits**: `tree-loops` measures memory for 1,000 rows. `corpus-heldout` brings 100 to 250 line files. Large-file compile time is measured in `final-gate`.
- **Security**: N/A beyond the compiler not evaluating input. The harness runs corpus code, which is written or license-checked in the repo.
- **Observability**: `compiler-api` diagnostics and the `units` list. The plugins print bailouts in dev (`switch`).
- **Performance**: `harness` and `final-gate`, with thresholds from `debate/debate.md` and noise checked with perf-pass `bench.py`. `compile-speed` is optional.
- **Testing**: unit tests per phase, the corpus harness on React and Preact, and the held-out set read only by `final-gate`. Each worktree runs its checks on its own.
- **Local files**: N/A. The checks need no gitignored files.
- **Developer experience**: `docs`. Examples are compiled by a test. Diagnostics carry a reason and an offset.
- **Rollout**: unreachable until `switch`. The 0.8 compiler keeps shipping until then. Users pin `forgetti@0.8` to stay on the old compiler.
- **Cleanup**: `switch` removes the 0.8 source, its snapshot tests, Babel dependencies and the lint exemption.
- **Coverage**: N/A. Built from a debate, not imported from a plan.
- **Dependencies**: `contracts` adds `oxc-parser` and `magic-string` (MIT, both used in the lab's compilers). `harness` adds `babel-plugin-react-compiler` and `forgetti@0.8.5` as private devDependencies.
