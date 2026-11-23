# Change request: phase-ir, member inputs

From node `fix-rc-callbacks`.

`ValueRef` gets a third variant: `{ kind: 'member'; id: number; name: string }`. It stands for `<binding name>.<name>`, a property read of a binding. The planner only emits it for the props object of a component (the first parameter, a plain name, never nullish) when every read of it in the block is `props.name` as a value. Emit reads the input as the binding name, a dot and `name`.

Why: `props.x` and `props.y` are compared as the whole `props` object today, and a new object each render makes every element miss (`base/jsxprops`, 6 against React Compiler's 1).

Applied locally in `packages/forgetti/src/next/ir.ts` and `emit/index.ts` (`getInput`). Needs the maintainer to fold it into `phase-ir.md`.
