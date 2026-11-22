# Log: planner-groups

- Gate at start (baseline planner): soundness and compiled share already pass. Work thresholds fail, and `tuning/alias_child` re-renders 4 against React Compiler's 3. So the feature was not built yet.
- Wrote `plan/cost.ts` and `plan/groups.ts`. Removed `baseline` from the pass list. `baseline.ts` stays as the helper module (helpers now exported).
- First gate run failed soundness: emit wrote a nested output as JSX text (`$[2]`). Fixed in `emit/index.ts` by wrapping the read in braces for JSX children and attribute values.
- A group that comes from a hook call (`useMemo` with a closure) was keyed on its inputs. Fixed by scanning the initializers and assignments of the group's members too.
- Baseline tests moved to `test/next/plan/groups/refusals.test.ts`. The mutated-local test now expects a block keyed on `a` and `b`.
