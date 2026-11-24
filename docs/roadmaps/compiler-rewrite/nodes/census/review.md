# Review: census (`chore/census`, commits 4cc0f2f, 8af5311, be544cd)

Reviewer expectations were written first, in `expectations.md`. Paths below are relative to the branch worktree `.claude/worktrees/agent-a53f23090643fea1e`.

## Verdict

Sound. The ranking can be used to pick the family nodes. I reproduced every headline figure, from the committed data and from fresh harness runs. The ranked families (A, C, D, P18 and the A+B+C bundle) all have 0 differences from uncompiled output. A relaxed run never adds work on any step. Compiler output is byte-identical with and without the patch. Nothing reads `heldout3`. The findings below are corrections to wording and to two secondary totals, plus one claim that goes further than the data. None of them changes the ranking.

## What I reproduced

| Check | How | Result |
| --- | --- | --- |
| Tables come from the committed data | ran `analyze.py` on the branch | the printed output matches `relax.tsv`; `git status` is clean after the run, so all regenerated TSVs are byte-identical |
| A alone = 46 | fresh `run.ts relax outer:identity` on the 4 dev sets, patch applied | 46 React and 46 Preact (form_check 27, toast_stack 19), excess 9, 0 differences |
| Bundle on `discussions_table` = 56 | fresh `run.ts variant outer:purity,outer:identity` | 56 lost units, 42 excess, 0 differences; toaster_store 25 |
| Bundle 102 = 56 + 46 | the two runs cover different files (discussions_table, and form_check plus toast_stack) | no overlap, so the sum is not a double count |
| The bundle needs all three parts | not on the branch. I ran the variant with `outer:identity` only (A+B, no C) | discussions_table 0. With the other committed runs (B alone 0, B+C 6, A+C 6) this confirms "each part alone saves at most 6" |
| The bundle holds with the narrow rules | not on the branch. I ran the variant with `global:Date` and `outer:identity:wrapper_member_{write,read}` only | same 56 / 42, 0 differences. The narrow rules A and C match the broad relaxation, so 102 is not inflated by relaxing too much |
| Steps whose output differs are excluded | `analyze.py:351-354`, `:362-365` | a step counts only when the relaxed row has `same` true. The baseline has 0 next steps that differ |
| Differences per relaxation | my script over every `relax-*` and `variant-*` file | identity, identity-member, identity-purity, purity, global:Date, result:call and all 3 variants: 0. `global` (all globals): 6 per target. `props`: 3. `relax-all`: 9. All are in `tuning/callback_globals` |
| Relaxing never adds work | my script: relaxed work above baseline work on any step whose output matches | 0 units in every run. Plain's work is also unchanged in every run, so the variants do not lower the uncompiled baseline |
| Output unchanged | `run.ts dump` with the patch applied, then with it reversed, `diff -r` | no difference (114 files) |
| Scope | `git diff --stat`, grep | only `results/census/**` and the node folder change. The single `heldout3` match is the sentence in `census.md:3` saying it was not opened |
| Every `displayName` write is an unconditional top-level statement | listed every `wrapper_member` refusal and grepped each binding's member uses | 21 bindings, all `X.displayName = '...'` at column 0. No `X.Item` member exists in the dev sets |
| `useStore` is a compiled unit (rule D needs a slot there) | `refusals.jsonl` | yes, it already holds a `root:value` block |

I applied the patch in the branch worktree, ran the commands, reversed the patch and deleted my temporary files. `git status` is clean.

## Findings

### 1. Medium: "no sound family" for `callback_globals` goes further than the data (`outcome.md:41`, `census.md:88`)

- **Failure scenario:** the orchestrator treats the 5 excess units in `tuning/callback_globals` as unreachable and does not consider a narrow rule for 3 of them.
- **Evidence:** the claim holds for `GlobalMemo` and `GlobalPlain` (2 units). React Compiler's 0 on `again_clear` comes from a stale cache whose output happens to match: on the `again` and `clear_global` steps of the same scenario its output differs. `relax-global-all` repeats that pattern (DIFF on `again` and `clear_global`, match on `again_clear`). Any cache that skips `again_clear` without reading the global also skips `again`, and is wrong there.
- It does not hold for `PropsFill` (3 units). React Compiler does 0 work on all three steps and its output matches on all six `PropsFill` steps. `relax-props` saves nothing because it also caches `<i>{props.items.length}</i>`, which goes stale, so all 3 of its saved steps differ. A narrower rule was never measured: `append(props.items, props.b)` receives props members, not `props`, so it cannot reassign `props.a`. Keying `<Child v={props.a} />` on `props.a` then carries the same assumption next already makes for every props member input. `census.md:88` says "no sound rule measured", which is accurate. `outcome.md:41` says "no sound family", which is not.
- The unmeasured `toaster_store` `pause/pause` row (4 units, member inputs on `state.toasts`, `census.md:84`) is the same shape. Together they are 7 of the 87 excess units (8%).
- **Fix:** change `outcome.md:41` to "no sound rule measured for `PropsFill`; the global reads have none". Name "member inputs past a call that receives only members" as an unmeasured candidate.

### 2. Low: `relax-all`'s "60 of 446" and "18 of 87" count 2 units from an unsound run (`census.md:9`, `outcome.md:18`)

- **Failure scenario:** the sound total that relaxing every refusal could reach is overstated.
- **Evidence:** the filter works per step (`analyze.py:353`). In `relax-all` and `relax-global-all`, the 2 `callback_globals` `again_clear` units are counted because those steps happen to match, while the same scenarios differ on `again` and `clear_global`. The sound figures are 58 lost units and 16 excess units.
- **Fix:** skip saved units in any scenario where the run differs on some step, or give the 58 and 16 alongside 60 and 18. The ranked families are not affected: all have 0 differences.

### 3. Low: the rule D sketch has no read-only check (`census.md:124`)

- **Failure scenario:** a family node builds D as written and caches a `{}` default that the function then changes. The uncompiled code gets a fresh object on every call. The cached code shares one object, so changes leak from one render to the next.
- **Evidence:** the variant is a fair stand-in for `toaster_store`, because `toastOptions` is only read there (`toastOptions[t.type]?.duration`, `toastOptions?.duration`). Its module-level `NO_OPTIONS` shares one object across instances, where the sketch keeps one per instance. That makes no difference to the work count in this scenario.
- **Fix:** add "the parameter's uses pass `isResultReadOnly`" to the sketch, plus a mutation operator that writes to the default.

### 4. Low: B and D are measured through source edits (stand-ins). The report says so

- **Evidence:** the diffs are the stated changes plus `oxfmt` line wrapping and a relative-path fix in `scenarios.js`. `toaster_default` changes `toastOptions = {}` to a module `NO_OPTIONS`. `discussions_columns` moves the inline `columns` literal into a `const` before `return`. Moving it is safe for evaluation order: the literal holds only strings and functions.
- Can a planner rule reproduce them? B: a nested literal given its own block is what a separate `const` statement already gets, so the rule has a concrete target. D: `useStore` is already a compiled unit with a block, so a slot for the default fits there. Both look buildable. Both stay estimates until a rule exists, as `census.md:133` says.

### 5. Info, for the orchestrator: the bundle passes the 15% rule only as a single family (`census.md:22-28`)

- No single rule reaches 15% (A 10.3%, D 5.6%). A+B+C reaches 22.9% of lost units (16.7% of lost steps) only when its three rules are counted as one family. The measurements support treating them as one family: on `discussions_table` the three only work together. Whether to accept that under P18 and O18 is a call for the orchestrator.
- D is 28.7% of the excess over React Compiler but 5.6% of lost units. The debate's rule is written on equal-to-uncompiled steps, so D fails as written.
- The bundle's target, 51 units (half of 102), is a fair figure to hold a node to.

### 6. Nit: wrong file counts in a report that calls itself exact (`census.md:3`, `census.md:160`)

- "62 files" and "124 files": the 4 dev sets hold 57 cases, and `dump` writes 114 files (57 per target). The data is fine. Only the stated counts are wrong.

### 7. Nit: the instrumentation commit is in the branch history

- 4cc0f2f adds code to `packages/` and 8af5311 removes it. The net diff is clean. A merge commit would still carry instrumented `packages/` code in the history. Squash when merging.

## Against my expectations

- Sites counted as hits: avoided. The ranking comes from counterfactual runs. The refusal-site table (`census.md:101-117`) is labelled "not lost steps".
- Counterfactuals that change soundness: every ranked figure has 0 differences, and differences are reported for every run. The one gap is finding 2.
- Steps that differ from uncompiled: excluded per step. The baseline has none.
- Double counting: none within a target, since the bundle sums disjoint files. React and Preact are reported separately.
- Upper bounds reported as exact: `census.md:130` labels the relax runs as upper bounds. My narrow-key run shows the bundle is not loosened by relaxing too much. The variants are labelled as stand-ins.
- The no-refusal bucket: given implicitly as 446 − 60 = 386 units that no refusal explains. The report states this up front (`census.md:9`).
