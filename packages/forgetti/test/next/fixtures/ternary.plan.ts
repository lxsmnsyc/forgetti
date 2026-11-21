import type { CachePlan } from '../../../src/next/ir';
import { findRange, findSpan } from './range';

// Corpus file `debate/evidence/corpus/ternary.jsx`. Hand output: `proof-t2/hand/ternary.jsx`.
export const source = `import { bump, Child } from './counter.js';
export function Ternary({ ok, a, b }) {
  return ok ? <div><Child v={a} /></div> : <span><Child v={b} /></span>;
}
`;

// Binding ids: ok 0, a 1, b 2.
const consequent = findRange(source, '<div><Child v={a} /></div>');
const alternate = findRange(source, '<span><Child v={b} /></span>');

/** A root with no slots of its own and two branch nodes, one per arm. */
export const plan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(source, 'export function Ternary', '}\n'),
    size: 2,
    blocks: [],
    children: [
      {
        kind: 'branch',
        range: consequent,
        size: 2,
        parentIndex: 0,
        arm: consequent,
        blocks: [
          {
            id: 0,
            kind: 'value',
            first: 0,
            inputs: [{ kind: 'binding', id: 1 }],
            outputs: [{ range: consequent, local: 't0' }],
            at: consequent,
          },
        ],
        children: [],
      },
      {
        kind: 'branch',
        range: alternate,
        size: 2,
        parentIndex: 1,
        arm: alternate,
        blocks: [
          {
            id: 1,
            kind: 'value',
            first: 0,
            inputs: [{ kind: 'binding', id: 2 }],
            outputs: [{ range: alternate, local: 't1' }],
            at: alternate,
          },
        ],
        children: [],
      },
    ],
  },
};
