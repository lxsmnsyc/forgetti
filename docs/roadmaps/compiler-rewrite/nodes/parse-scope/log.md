# Log: parse-scope

- 2026-11-22: started. `src/next/parse/` did not exist, so no criterion held. Building it from scratch.
- Plan: `presets.ts`, `scope.ts` (scopes, bindings, references), `units.ts` (unit finder), `index.ts` (`parseAndScope`). Test units against 0.8 by mocking its `Optimizer` and recording the nodes it gets.
- Units match 0.8 on all 15 base corpus files via a mocked `Optimizer`. References match Babel `scope.getBinding` on the corpus and a stress module.
- Wrote `contracts/phase-ir.parse-scope.change-request.md` (module scope kind, JSXIdentifier references). The plain name was taken by the accepted `emit` request.
- Fast check passes: 187 tests, lint exit 0.
- Review fixes: body gets its own scope when parameters have defaults, function expression names get their own scope, static blocks keep `var`, `<this.Foo>` adds no global, HOC skip search stops at functions. Applied the accepted change request in `ir.ts` (scope 0 is `module`). 196 tests pass, lint exit 0.
