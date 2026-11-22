
## compiler-rewrite, wave 2 (2026-11-22)

- harness: M, 216k tokens, 1 review round.
- emit: L, 313k tokens, 1 review round, 1 change request.
- parse-scope: L, 274k tokens, 2 review rounds, 1 change request.
- corpus-tuning: M, 223k tokens, 2 review rounds.

## compiler-rewrite, wave 3 (2026-11-22)

- eligibility: M, 333k tokens, 2 review rounds.
- runtime: M, 324k tokens, 2 review rounds.
- ownership: L, 1.14M tokens, 4 fix rounds (3 full reviews and 1 orchestrator check). Every round found a real soundness gap in closure and alias tracking. Estimate alias analysis nodes at XL.
