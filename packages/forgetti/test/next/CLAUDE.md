# test/next

- Assert phase output as binding names and source text, not ids and offsets. The expectations then read like the code and survive id renumbering.
- `test/next/runtime.test.ts` renders on React and Preact. React Suspense steps need waits over 300 ms, because React 19 holds back resolved content for that long after a fallback.
