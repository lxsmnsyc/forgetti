# Log: eligibility

- `returns-fresh-from-hook`: the brief says "fresh value returned from a hook", but corpus `hook` returns `{ x, y }` and must be eligible. Narrowed the rule to a returned const that holds a fresh value and is changed later inside a closure (effect or callback). A cached hook would share that object across renders. Open doubt: the maintainer may want a different reading.
- Closures are not checked for mutations of props, state or hook arguments: they run later, not in render. Calls inside closures that run during render (such as `.map` callbacks) are therefore missed. Ownership can tighten this.
- Fresh means an object, array, `new`, function, class or JSX literal, or a `const` initialised with one. Calls are never fresh here.
- Mutating methods: push pop shift unshift splice sort reverse fill copyWithin set add delete clear.
- Not done: mutation of hook results (other than the `useState` value), `unsupported-syntax`, `escaping-closure` (ownership).
