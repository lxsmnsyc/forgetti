import type { CachePlan } from '../../../src/next/ir';
import { findRange, findSpan } from './range';

// Corpus file `debate/evidence/corpus/derived.jsx`. Hand output: `proof-t2/hand/derived.jsx`.
export const source = `import { bump } from './counter.js';
function costly(k, v) { bump(k); return v * 2; }
export function Derived({ a, b }) {
  const x = costly('x', a);
  const y = costly('y', b);
  const z = x + 1;
  return <div>{x}-{y}-{z}</div>;
}
`;

// Binding ids: a 0, b 1, x 2, y 3, z 4. `z` is cheap and derived from `x`, so it is not an input.
const xCall = findRange(source, "costly('x', a)");
const yCall = findRange(source, "costly('y', b)");
const output = findRange(source, '<div>{x}-{y}-{z}</div>');

/** Three value blocks in one root: two costly calls, then the JSX that reads their results. */
export const plan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(source, 'export function Derived', '}\n'),
    size: 7,
    blocks: [
      {
        id: 0,
        kind: 'value',
        first: 0,
        inputs: [{ kind: 'binding', id: 0 }],
        outputs: [{ range: xCall, local: 't0' }],
        at: findRange(source, "const x = costly('x', a);"),
      },
      {
        id: 1,
        kind: 'value',
        first: 2,
        inputs: [{ kind: 'binding', id: 1 }],
        outputs: [{ range: yCall, local: 't1' }],
        at: findRange(source, "const y = costly('y', b);"),
      },
      {
        id: 2,
        kind: 'value',
        first: 4,
        inputs: [
          { kind: 'binding', id: 2 },
          { kind: 'binding', id: 3 },
        ],
        outputs: [{ range: output, local: 't2' }],
        at: findRange(source, 'return <div>'),
      },
    ],
    children: [],
  },
};
