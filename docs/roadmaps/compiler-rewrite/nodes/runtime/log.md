# Log: runtime

- The stub already satisfied the contract. Work was tests plus size.
- Stub minified to 490 bytes, over the 400 budget. Dropped the `Symbol` description, used `Array(n).fill`, rewrote the `keep` loop backwards. `??=` downlevels badly at es2018, so `||=` with a disable comment.
- Preact 11 has no StrictMode and no interruptible render, so those cases run on React only.
- Proof T1 says inputs-first differs on throw (React). Confirmed for `throw` and `transition`; it is asserted on React only, since Preact's retry behavior is not guaranteed. A pure test in `api.test.ts` covers the rule without a renderer.
