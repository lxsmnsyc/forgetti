
## compiler-rewrite, wave 2 (2026-11-22)

- harness: M, 216k tokens, 1 review round.
- emit: L, 313k tokens, 1 review round, 1 change request.
- parse-scope: L, 274k tokens, 2 review rounds, 1 change request.
- corpus-tuning: M, 223k tokens, 2 review rounds.

## compiler-rewrite, wave 3 (2026-11-22)

- eligibility: M, 333k tokens, 2 review rounds.
- runtime: M, 324k tokens, 2 review rounds.
- ownership: L, 1.14M tokens, 4 fix rounds (3 full reviews and 1 orchestrator check). Every round found a real soundness gap in closure and alias tracking. Estimate alias analysis nodes at XL.

## compiler-rewrite, wave 5 (2026-11-24)

- corpus-heldout: M, 280k tokens, 1 review round plus 2 small fix rounds. The worker rewrote sources instead of copying them; ask for near-verbatim code up front.
- eligibility-writes: M, 290k tokens, 5 fix rounds. Like ownership, each round found a new soundness gap in alias and copy tracking. Estimate write and alias analysis nodes at L or XL, and ask the worker for one value classifier from the start.

## compiler-rewrite, wave 6 (2026-11-24)

- tree-loops: M, 273k tokens, 1 fix round. The fresh review found a `var` loop header treated as per-iteration (stale closures); the corpus had no `var` loop. Ask loop and scope workers to probe `var` declarations up front.
