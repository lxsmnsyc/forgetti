# Log: s1-baseline

- Verify command passed before any change (stub compiles nothing). The unit criterion and the work were not met, so the node was not "already fulfilled".
- Candidates are only statements directly in the unit body: `return <jsx/>`, `const x = <jsx/>`, `const x = call(...)`, and an arrow expression body that is JSX. Anything else is left as written. Hoisting before the statement then cannot reorder side effects.
- A call result is cached only when every use of its binding reads it (JSX, operators, member reads). A call with no inputs is never cached.
- Units with no cacheable block count as compiled and are left as written. Skipped units are compiled:false with no diagnostic (contract).
- Doubt: emit throwing on a bad plan propagates out of `compile()`. No per-unit fallback was added.
