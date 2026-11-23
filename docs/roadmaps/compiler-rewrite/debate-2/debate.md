---
goal: Change the forgetti next planner so it saves child re-renders and recomputes on component shapes it was not tuned on, meeting amendment-1's work thresholds on a fresh held-out set while staying sound and within size
date: 2026-11-23
rounds: 3 of 3
status: approved
roadmap: docs/roadmaps/compiler-rewrite
supersedes: debate/debate.md (its settled structure stands; this debate replaces the plan after `regate`)
decision: none
---

# Debate 2: a planner that saves work on code it was not tuned on

The record of every claim and ruling is `ledger.json`. Measurements are in `evidence/`.

## Why this debate

`regate` missed amendment-1 on `heldout2`, the clean set: React work 259 against React Compiler's 186, with next doing exactly the uncompiled work on 7 of 8 files while compiling 67 of 70 units (J2, J3). Every fix node since `final-gate` closed its target file and left the same families unfixed on unseen code (J5). Stopping is ruled out by the user (J10).

## Hypothesis

Fixed before any run. Change it only through a new debate.

- **Statement**: planner changes chosen by a refusal census weighted by lost steps (at most two family nodes) bring the new compiler's React work below React Compiler's on a held-out set nobody tuned on, with 0 differences from uncompiled output and within the size caps.
- **Metric**: amendment-1 work (child re-renders plus `costly()` recomputes), differences, gzip and compiled share. Measured on `heldout3` alone, then on all sets, on React 19 and Preact 11. `heldout3` has at least 8 files, at least half of them keep their library's file split, and planner work never sees it.
- **Baseline**: next at commit `5308757`:
  - `heldout2`: React 259 against React Compiler 186 (4 files above), Preact 256 against uncompiled 267, gzip 0.844.
  - All sets: React 633 against 723 (5 files above).
  - next at `5308757` is also run on `heldout3` at gate time, so a gain shows even on a miss.
- **Threshold**: every amendment-1 rule, on `heldout3` alone and on all sets:
  - 0 differences on both targets.
  - React: total strictly below React Compiler (adjusted on its wrong steps), and no file above it.
  - Preact: total and every file strictly below uncompiled output.
  - Total gzip at most 1.0 times React Compiler, and no file above 1.15 times.
  - Compiled share at least React Compiler's on held-out files.
  - Counts and gzip are exact.
- **Kill**:
  - a difference that cannot be fixed without bailing out more components than React Compiler;
  - total gzip above 1.3 times React Compiler;
  - a family node that closes less than half of its census-predicted share on the development sets is stopped, and not followed by narrower rules (P21).
- **Work miss**: a sound, within-size work miss on `heldout3` is not a kill. The new compiler ships in place of forgetti 0.8 and the React miss is recorded. No `heldout4` is built and no fix round reads `heldout3` output (Q1, P20).

## Settled structure

In ship order, one worktree at a time:

1. **Weighted refusal census** (P12, about 100k tokens, S). Extends proof T1:
   - every refusal names the binding or use that failed, so identity and purity failures are split (O9, P17);
   - `baseline.ts`, `loops.ts`, `branches.ts` and whole-unit bailouts are instrumented;
   - each refusal is joined to the steps where next does the uncompiled work, on the development sets (`base`, `tuning`, `heldout`, `heldout2`) only;
   - its output ranks refusal families by lost steps and fixes each family's predicted share.
2. **`heldout3`, sealed** (P4, P14, O19, about 330k plus 125k for the harness):
   - 8 to 10 real-shaped files from MIT libraries and apps not used before;
   - at least half keep the library's file split, and the harness compiles sibling modules with the compiler under test (P14, O13);
   - its brief forbids reading `debate-2/`, planner node outcomes and any compiled output, and its library list is fixed before the census reports (O19);
   - committed with a content hash. Planner workers never open it.
3. **Mutation soundness check** (O4, P15, P19, about 210k). A script inserts hazards into the existing 62 corpus files and reuses their scenarios (EMI, PLDI 2014). Operators cover:
   - aliasing a prop into a call, a changing global read in render, a closure called in a child's render, a method call inside `.map`;
   - a same-module child used as a tag whose render reads `Date.now()`, a changing global or `ref.current`, with and without `memo` (O8);
   - a `map`, `filter` or `find` callback that changes its element, and a `find` result changed after the call (O12);
   - a top-level `displayName` or `X.Item` write moved into a conditional, a function body or a handler (O10).

   Every planner change merges only with 0 differences on these mutants, both targets.
4. **At most two family nodes, taken from the census ranking** (O18). Each:
   - is built only when the census puts at least 15% of the equal-to-uncompiled steps on its family (P18);
   - states its predicted share before it starts, and is stopped if it closes less than half of it on the development sets (P21);
   - adds its own mutation operators.

   Candidate families, with the rules already argued:
   - **identity** (P17): a module binding is identity-stable when every member write or `Object.assign(X, ...)` on it is an unconditional top-level statement. A same-module child used as a tag still needs a pure eager body; `memo` stays exempt; imports stay assumed pure (O8, O9, O10).
   - **shared call results** (P18): callback-free methods (`includes`, `indexOf`, `slice`, `join`, `at`, `length`) count as read-only uses; callback methods only when the callback passes a mutation check and the result's uses pass the read-only check recursively (O12).
   - others the census may rank first: purity precision (`new Date(arg)` reads no clock, O16), fresh literals holding method components (`columns` with `Cell`, O16), method calls on hook results (`toaster_store`, O11, O17).
5. **Size**: the prune pass keeps its rule and gains a per-unit byte check, so new blocks that save no child render are dropped first (P6). `heldout/tree_view` has 4% left under the per-file cap (O7).
6. **Gate** on `heldout3` alone, then on all sets, with the thresholds above.

## Budget

- **device**: one worktree at a time; 8 GB RAM with about 3 GB free (J1). The harness runs in happy-dom.
- **time**: 6 nodes in sequence (census, `heldout3`, mutation check, up to two family nodes, gate). A full gate run takes a few minutes and is deterministic (J11).
- **tokens**: about 1.6M (1.5M to 1.8M), about 1.27M with one family node, by calibration (O14, P20). No node so far cost less than 174k.
- **soundness**: 0 differences on the corpus and on every mutant, both targets, before any planner change merges (P15, P19).
- **output size**: total gzip at most 1.0 times React Compiler and no file above 1.15 times; headroom today is 0.804 overall and 0.844 on `heldout2` (P6).

## Rejected

- **Invert the whole planner default** (P1): part of its mechanism already exists, and the families should come from data (O1, O5, J12).
- **Same-module prop-use summaries** (P2): the single-module corpus would overstate the gain, and unstable globals are 5 of 164 `heldout2` refusals (O2, J12).
- **Grammar-based random program generator** (P3): it needs a scenario generator and runs to 400k to 600k; mutating real corpus files does the same check for about half (O3, O4).
- **Generator-scored generalization** (P8): rests on P3, and synthetic shapes do not measure the goal.
- **The four narrow follow-up nodes from `regate`** (P7): repeats the pattern that closed target files and left unseen shapes unfixed (J5).
- **Fixing the family nodes before the census** (P20 as written): no shown path to `discussions_table` and `toaster_store`, which hold 71 of the 80 excess units (O17).

## Proofs

- **T1 for P1**: which planner refusal reasons account for units not cached where next does the uncompiled work? Done in about 20 of 30 minutes, 94k tokens. In `heldout2`, an element reading a module or imported binding that `isStableOuter` rejects leads with 51 of 164 refusals; call results that are passed on or changed 34; destructuring 30; deliberate cheap-expression skips 26; impure syntax 16; unstable globals 5. Counts are sites, not lost hits (J12).

## Prior art

- **forgetti 0.8**: caching nearly every expression saves work on unseen code (61 on `heldout2`) but costs 2.4 times the size and renders wrong output on 19 files (J8).
- **React Compiler 1.0**: caches every reactive value unless proven unnecessary, on a control-flow IR; sound on the corpus except `tuning/callback_globals` (J9). Used only as a black box.
- **Csmith (PLDI 2011) and YARPGen (OOPSLA 2020)**: grammar fuzzers find many compiler bugs, but avoiding invalid programs is most of the work (P3, O3).
- **EMI, Le, Afshari, Su (PLDI 2014)**: mutating existing programs finds compiler bugs with the original as oracle (O4). Adopted.

## Open risks

- **The two largest gaps may have no path** (O16, O17): `discussions_table` rebuilds an inline `columns` literal whose `Cell` method is a new component type every render, and `toaster_store` calls a method on a hook result. Measurement: the census ranks them. Accepted: if no family closes them, the work-miss rule applies.
- **Destructuring refusals** (30 in `heldout2`): measurement. The census says whether they cost hits.
- **`heldout/tree_view` size** (O7): measurement. The per-unit byte check in the prune pass, and the per-file cap at the gate.
- **The census measures refusal sites, not causes** (J12): the weighted census joins refusals to lost steps before any family node starts.

## Inferred choices

- **Stopping is off the table** (J10): from your messages in this session.
- **The earlier settled structure stands** (J10): oxc and magic-string, five phases, `useRef` tree cache, React 19 and Preact 11, no React Compiler-style IR (`debate/debate.md`, `GOAL.md` non-goals).
- **One worktree at a time** (J1): from `capacity.py`.

## Answers from the user

- **Q1**, what follows a sound, within-size React work miss on `heldout3`: ship the compiler as it is in place of forgetti 0.8, and record the miss. Planner improvements can follow in later releases.

## Overruled

- None.

## Cost of this debate

- 3 of 3 rounds, about 761k tokens, including proof T1.
