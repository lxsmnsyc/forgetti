import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CachePlan } from '../../../src/next/ir';
import { findRange, findSpan } from '../fixtures/range';
import { emitPlan, loadModule, prepareOutDir, removeOutDir, runSteps } from './harness';

beforeAll(prepareOutDir);
afterAll(removeOutDir);

// A computation throws on an update and React renders again at once with the same props.
// Writing an input before its value would make that second render a hit on a stale value.
// Each case also runs a copy of the output with the inputs written first, which must differ.

const callSource = `import { bump } from './counter.js';
function costly(v) { bump('costly'); if (v < 0) throw new Error('negative ' + v); return v * 2; }
export function Call({ a }) {
  const x = costly(a);
  return <p>{x}</p>;
}
`;

// Binding ids: a 0, x 1.
const callPlan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(callSource, 'export function Call', '}\n'),
    size: 4,
    blocks: [
      {
        id: 0,
        kind: 'value',
        first: 0,
        inputs: [{ kind: 'binding', id: 0 }],
        outputs: [{ range: findRange(callSource, 'costly(a)'), local: 't0' }],
        at: findRange(callSource, 'const x = costly(a);'),
      },
      {
        id: 1,
        kind: 'value',
        first: 2,
        inputs: [{ kind: 'binding', id: 1 }],
        outputs: [{ range: findRange(callSource, '<p>{x}</p>'), local: 't1' }],
        at: findRange(callSource, 'return <p>'),
      },
    ],
    children: [],
  },
};

const groupSource = `import { bump } from './counter.js';
function first(v) { bump('first'); return 'f' + v; }
function second(v) { bump('second'); if (v < 0) throw new Error('negative ' + v); return 's' + v; }
export function Group({ a }) {
  const f = first(a);
  const s = second(a);
  return <p>{f}{s}</p>;
}
`;

// Binding ids: a 0, f 1, s 2. One compare on `a` guards both values.
const groupPlan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(groupSource, 'export function Group', '}\n'),
    size: 6,
    blocks: [
      {
        id: 0,
        kind: 'value',
        first: 0,
        inputs: [{ kind: 'binding', id: 0 }],
        outputs: [
          { range: findRange(groupSource, 'first(a)'), local: 't0' },
          { range: findRange(groupSource, 'second(a)'), local: 't1' },
        ],
        at: findRange(groupSource, 'const f = first(a);'),
      },
      {
        id: 1,
        kind: 'value',
        first: 3,
        inputs: [
          { kind: 'binding', id: 1 },
          { kind: 'binding', id: 2 },
        ],
        outputs: [{ range: findRange(groupSource, '<p>{f}{s}</p>'), local: 't2' }],
        at: findRange(groupSource, 'return <p>'),
      },
    ],
    children: [],
  },
};

const rowSource = `import { bump } from './counter.js';
function label(item) { bump('label'); if (item.bad) throw new Error('bad ' + item.id); return item.name; }
export function Rows({ items }) {
  return <ul>{items.map((item) => <li key={item.id}>{label(item)}</li>)}</ul>;
}
`;

// Binding ids: items 0, item 1. Each row has its own cache, by position.
const row = findRange(rowSource, '<li key={item.id}>{label(item)}</li>');
const rowPlan: CachePlan = {
  unit: 0,
  root: {
    kind: 'root',
    range: findSpan(rowSource, 'export function Rows', '}\n'),
    size: 1,
    blocks: [],
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
            id: 0,
            kind: 'value',
            first: 0,
            inputs: [{ kind: 'binding', id: 1 }],
            outputs: [{ range: row, local: 't0' }],
            at: row,
          },
        ],
        children: [],
      },
    ],
  },
};

const good = [
  { id: 1, name: 'n1' },
  { id: 2, name: 'n2' },
];
const bad = [good[0], { id: 2, name: 'n2', bad: true }];

const cases = [
  {
    name: 'call slot',
    source: callSource,
    plan: callPlan,
    names: ['a', 'x'],
    component: 'Call',
    steps: [{ a: 1 }, { a: -1 }],
    inputsFirst: ['{ $[1] = costly(a); $[0] = a; }', '{ $[0] = a; $[1] = costly(a); }'],
  },
  {
    name: 'grouped slot',
    source: groupSource,
    plan: groupPlan,
    names: ['a', 'f', 's'],
    component: 'Group',
    steps: [{ a: 1 }, { a: -1 }],
    inputsFirst: [
      '{ const t0 = first(a), t1 = second(a); $[1] = t0; $[2] = t1; $[0] = a; }',
      '{ $[0] = a; const t0 = first(a), t1 = second(a); $[1] = t0; $[2] = t1; }',
    ],
  },
  {
    name: 'per-row cache',
    source: rowSource,
    plan: rowPlan,
    names: ['items', 'item'],
    component: 'Rows',
    steps: [{ items: good }, { items: bad }],
    inputsFirst: [
      '{ $1[1] = <li key={item.id}>{label(item)}</li>; $1[0] = item; }',
      '{ $1[0] = item; $1[1] = <li key={item.id}>{label(item)}</li>; }',
    ],
  },
];

describe.each(cases)('$name throws and retries', (testCase) => {
  const emitted = emitPlan(testCase.source, testCase.plan, testCase.names);

  it('matches uncompiled output', async () => {
    const plain = await runSteps(
      await loadModule(testCase.source),
      testCase.component,
      testCase.steps,
    );
    const next = await runSteps(await loadModule(emitted), testCase.component, testCase.steps);
    expect(plain[1].html).toContain('error: ');
    expect(next.map((step) => step.html)).toEqual(plain.map((step) => step.html));
  });

  it('differs when inputs are written first', async () => {
    const [ordered, broken] = testCase.inputsFirst;
    expect(emitted).toContain(ordered);
    const plain = await runSteps(
      await loadModule(testCase.source),
      testCase.component,
      testCase.steps,
    );
    const wrong = await runSteps(
      await loadModule(emitted.replace(ordered, broken)),
      testCase.component,
      testCase.steps,
    );
    expect(wrong[1].html).not.toEqual(plain[1].html);
  });
});
