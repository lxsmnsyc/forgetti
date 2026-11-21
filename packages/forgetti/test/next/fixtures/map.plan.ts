import type { CachePlan } from '../../../src/next/ir';
import { findRange, findSpan } from './range';

// Corpus file `debate/evidence/corpus/map.jsx`. Hand output: `proof-t2/hand/map.jsx`.
export const source = `import { bump, Row } from './counter.js';
export function MapList({ items, title }) {
  return (
    <ul title={title}>
      {items.map((item) => <Row key={item.id} item={item} />)}
    </ul>
  );
}
`;

// Binding ids: items 0, title 1, item 2.
const mapCall = findRange(source, 'items.map((item) => <Row key={item.id} item={item} />)');
const row = findRange(source, '<Row key={item.id} item={item} />');
const list = findRange(source, '<ul title={title}>');
const listEnd = findRange(source, '</ul>');
const ul = { start: list.start, end: listEnd.end };
const returnStatement = findRange(source, 'return (');

/**
 * Slot 0 holds the iteration node, slot 1 holds the `keep` block for the mapped array,
 * slots 2 to 4 hold the `<ul>` block: `title`, the kept array, and the element.
 * The `<ul>` output contains the `keep` output, so the two ranges nest.
 */
export const plan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(source, 'export function MapList', '}\n'),
    size: 5,
    blocks: [
      {
        id: 0,
        kind: 'keep',
        first: 1,
        inputs: [],
        outputs: [{ range: mapCall, local: 't1' }],
        at: returnStatement,
      },
      {
        id: 1,
        kind: 'value',
        first: 2,
        inputs: [
          { kind: 'binding', id: 1 },
          { kind: 'output', block: 0, index: 0 },
        ],
        outputs: [{ range: ul, local: 't2' }],
        at: returnStatement,
      },
    ],
    children: [
      {
        kind: 'iteration',
        range: row,
        size: 2,
        parentIndex: 0,
        body: row,
        indexLocal: 'i',
        blocks: [
          {
            id: 2,
            kind: 'value',
            first: 0,
            inputs: [{ kind: 'binding', id: 2 }],
            outputs: [{ range: row, local: 't0' }],
            at: row,
          },
        ],
        children: [],
      },
    ],
  },
};
