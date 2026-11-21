---
goal: Design a new set of compiler phases for forgetti on oxc and magic-string that keep the tree cache, are sound on React 19 and Preact 11, and beat both forgetti 0.8 and React Compiler 1.0 on the measured corpus
date: 2026-11-21
rounds: 3 of 3
status: proposed
roadmap: docs/roadmaps/compiler-rewrite
supersedes: none
decision: none
---

# Debate: the forgetti compiler rewrite

The record of every claim and ruling is `ledger.json`. The baseline research is `research.md`. Measurements and proofs are in `evidence/`.

## Answer to "is React Compiler's approach optimal?"

No. It is sound on the corpus, but it is not the best on re-renders or recomputes:

- It caches a whole list as one value, so one changed item re-renders every row (`map`: Row3 against Row1).
- It keys a ternary on the inputs of both branches, so a change in the branch that is not shown re-renders the child (`ternary`).
- It skips caching some call results (`derived`, `hook`).

Proof T2 shows output that avoids all three, at 0.73 to 1.29 times React Compiler's bytes, with no differences from uncompiled React (J12). React Compiler's soundness does come from tracking mutation, and forgetti 0.8 fails exactly where it has none (J2). The rewrite therefore needs a mutation model, but not React Compiler's control-flow IR and scope design.

## Hypothesis

Fixed before any build. Change it only through a new debate.

- **Statement**: a five-phase oxc and magic-string compiler is sound and beats both forgetti 0.8 and React Compiler 1.0. Its parts are alias groups, a `useRef` tree cache, dependency-set slots and cached JSX elements.
- **Metric**: measured on the grown corpus (at least 35 files, at least 10 of them held out) on React 19.3 and Preact 11.2:
  - differences from uncompiled output
  - total child re-renders plus `costly()` recomputes over the runtime scenarios
  - gzip bytes, counting one runtime import
  - the share of components compiled
- **Baseline**: React Compiler 1.0.0 and forgetti 0.8.5 on the 15-file corpus:
  - 0 and 3 differences (J2)
  - bytes in `evidence/out/compile-table.json` (J3)
  - render rows in `evidence/out/runtime-table.txt` (J4)
  - React Compiler compiles 14 of 15 files
- **Threshold**:
  - 0 differences on every file and both targets
  - total re-renders plus recomputes strictly below each compiler, and no file above the better of the two
  - total gzip at most 1.0 times React Compiler, and no file above 1.15 times
  - a compiled share at least React Compiler's on the held-out files
- **Kill**: any one of these ends the attempt:
  - a difference from uncompiled output that cannot be fixed without bailing out more components than React Compiler
  - total gzip above 1.3 times React Compiler after S3
  - spend above 800k tokens before S4

## Settled structure

The phases run once on one parse. Only the last phase writes, with magic-string at original source ranges (P1).

1. **Parse and scope**: oxc-parser. Finds components and hooks, and builds bindings with their references (P1).
2. **Eligibility**: decides per component whether it can be compiled, and reports why not (P3, P14). Bailout triggers:
   - mutation of props, state or hook arguments
   - a fresh value stored in `ref.current` or a module variable
   - a fresh value returned from a hook
   - a closure holding a fresh value that escapes before its group is frozen
3. **Ownership**: alias groups (P7, P14).
   - A fresh value is a literal, array, object or known constructor result created in this render.
   - These join one group: assignment, a store into a field, array element, `Map` or `Set`, and closure capture. Calling a captured closure counts as a mutation.
   - A spread copy starts a new group.
   - An unknown call that receives a fresh value is a mutation site. The call itself is never cached apart from its group.
   - A group is frozen after its last mutation. It is cached as one block keyed on its non-fresh inputs, so later slots can hit (O12).
4. **Cache-tree plan**: decides what each cache holds.
   - Values with the same input set share one compare and one slot block (P4).
   - Expressions cheaper than one compare get no slot (P4).
   - `use()`, hook calls and impure statements never get a slot (P3).
   - Each branch of `if`, `switch` and a ternary gets a lazy child cache (P5).
   - Each loop iteration and `.map` call gets a child cache by position (P5, A2).
   - JSX is cached as element values and is never outlined (P5).
5. **Emit**: magic-string inserts the slot code at the original ranges (P1).
   - The value is computed into a local first. Its inputs and the value are written together after it returns. This holds for every slot shape (P17, J13).
   - Empty slots hold a sentinel (P12, J12).

**Runtime** (P11, P16):

- `useCache(size)` on `useRef`, created lazily.
- `branch(parent, index, size)` for child caches.
- `keep()` for result arrays compared element by element.
- Comparisons use `Object.is`.
- Nothing is imported from `react/compiler-runtime`, so the same runtime serves Preact 11.

**Ship order** (P6). Each step merges alone and is gated by the corpus:

- **S1, sound baseline**: phases 1, 2 and 5 plus the runtime. Gate: 0 differences on all files, plus three throw-and-retry cases (P17).
- **S2, ownership and grouped slots**: gated by six alias files (P8) and the bailout rate (P15).
- **S3, tree cache**: branches first, then positional iteration caches.
- **S4, final gate**: the grown, held-out corpus (P10, O14) checked against the hypothesis. Compile time is measured on oxc.

Stopping after S2 still leaves a sound compiler of about 5k lines (P9).

## Budget

- **device**: one worktree at a time. The machine has 8 cores, 8 GB RAM and about 3.4 GB free (J1). The corpus runs in happy-dom and needs little memory.
- **time**: about 9,000 lines (7,500 to 10,500), based on silmaril at 9.1k lines on the same stack (P9, J6). This is an estimate. Check it after S1 (O3).
- **tokens**: about 600k (450k to 800k) for the build. The 800k mark is a kill criterion before S4 (P9).
- **soundness**: 0 differences from uncompiled output on every gate (P3, P8, P17).
- **output size**: total gzip at most 1.0 times React Compiler, and no file above 1.15 times (P16, O9).

## Rejected

- **Sound-first cut (S1 and S2 only, outlined JSX kept)**: misses the size goal (A1).
- **Keep 0.8's emit and swap only the parser**: 17 of 19 core files are Babel path rewrites, so nothing carries over to magic-string (O6, J11).
- **Per-local ownership without alias groups**: misses aliased mutation (P2, O2).
- **Bail out on every fresh value passed to an unknown function**: would compile fewer components than React Compiler (P7 first version, O8).
- **Keyed iteration caches by default**: about 11k retained slots per 1,000 rows. Keys come later, and only if positional caches fail a measured row (O7, A2).
- **The `useRef` cache is unsafe under discarded renders**: disproved by proof T1 (O1, J13).
- **Child caches force 0.8-sized output**: disproved by proof T2 (O4, J12).

## Proofs

- **T1 for O1**: is a `useRef` cache safe under interrupted transitions, Suspense, StrictMode and a throw with retry? Done. It is safe when inputs and value are written after the computation returns. Writing inputs first fails on throw and retry. Cap 30 min, took about 12 min (J13).
- **T2 for O4**: does hand output under the P4 and P5 rules come within 1.5 times React Compiler's bytes? Done. It came to 0.73 to 1.29 times, with 0 differences in 14 scenarios and fewer re-renders than React Compiler on 4 rows. Cap 30 min, took about 10 min (J12).

## Prior art

- **React Compiler 1.0**: a control-flow IR with mutation and alias effects and reactive scopes over one flat cache. It was sound on the corpus but coarse on lists and ternaries (J10, J4).
- **forgetti 0.8**: per-expression slots on Babel with no mutation model. It gave 3 stale or divergent cases out of 15 (J2), which is a negative result for compiling without a mutation model.
- **The lab's oxc and magic-string compilers** set the line-count basis (J6):
  - solid-optimizer: 15.6k lines over 251 commits
  - silmaril: 9.1k lines
  - solid-styled: 3.3k lines

## Open risks

- **The `keep()` size figure for `map` (O13)**: measurement. It was measured by hand once and not saved, so the S4 gate measures all files.
- **Overfitting the corpus (O5)**: measurement. At least 10 held-out real-shaped files are read only at S4 (P10, O14).
- **The budget estimate (O3)**: measurement. Compare lines and tokens against P9 after S1, and send the goal back to a debate when S1 alone passes half the budget.
- **Bailout rate on real code (O8)**: measurement. The P15 gate lists each component that the rewrite skips and React Compiler compiles.
- **Not covered by T1**: an effect or event handler that reads the cache, and an error boundary swap that keeps the ref. Accepted, because the cache is only read during render. One S1 corpus case covers the boundary swap.

## Inferred choices

- **Toolchain, tree cache, targets, and independence from React Compiler's design (J8)**: fixed by you in this session.
- **What "beat both" means (J14)**: fewer re-renders plus recomputes than each compiler in total, and no file worse than the better of the two. Size and bailout rate are no worse than React Compiler, and soundness is a hard gate. Inferred from the goal text and J4. You can tighten the size threshold at approval.
- **One worktree at a time (J1)**: from `capacity.py`.

## Answers from the user

- **Toolchain**: oxc and magic-string.
- **Process**: debate first, then roadmap.

## Overruled

- none

## Cost of this debate

- 3 of 3 rounds, about 446k tokens, including the two research agents and two proofs.
