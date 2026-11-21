# Proof T1: a `useRef` cache under discarded renders

React 19.3.1 development build in happy-dom. Run with `node t.mjs`. Each case ran plain and in StrictMode. Output HTML and the log of values from every render, discarded renders included, were compared against the uncompiled component.

| Case | `useRef`, value then inputs | `useRef`, inputs then value | `useMemo` |
| --- | --- | --- | --- |
| Transition render interrupted, discarded, restarted | same | same | same |
| Suspend on first mount after slots computed | same | same | same |
| Suspend on update, abandoned or resolved with other props | same | same | same |
| StrictMode on every case | same | same | same |
| Computation throws on update, React retries | same | different | same |
| Throw after all slots are written | same | same | same |
| Computation throws inside a transition | same | different | same |

Rule for a safe `useRef` cache:

- Each slot stores its own inputs next to its value, and a hit compares those stored inputs.
- Inputs and value are written only after the computation returns. Writing inputs first leaves matching inputs with a stale value when the computation throws.

Not tested: effects or event handlers that read the cache, and an error boundary swap that keeps the ref.
