import { parseSync } from 'oxc-parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emit } from '../../../src/next/emit';
import type { CacheNode, CachePlan, Range, SlotBlock } from '../../../src/next/ir';
import { findRange, findSpan } from '../fixtures/range';
import { RUNTIME, emitPlan, loadModule, prepareOutDir, removeOutDir, runSteps } from './harness';

beforeAll(prepareOutDir);
afterAll(removeOutDir);

/** A value block with binding inputs and one output. */
function createBlock(
  id: number,
  first: number,
  inputs: number[],
  output: Range,
  at: Range = output,
): SlotBlock {
  const refs: SlotBlock['inputs'] = [];
  for (const input of inputs) {
    refs.push({ kind: 'binding', id: input });
  }
  return {
    id,
    kind: 'value',
    first,
    inputs: refs,
    outputs: [{ range: output, local: `t${id}` }],
    at,
  };
}

function createRoot(
  source: string,
  start: string,
  size: number,
  blocks: SlotBlock[],
  children: CacheNode[],
): CachePlan {
  return {
    unit: 0,
    root: { kind: 'root', range: findSpan(source, start, '}\n'), size, blocks, children },
  };
}

function createBranch(
  arm: Range,
  parentIndex: number,
  size: number,
  blocks: SlotBlock[],
  children: CacheNode[] = [],
): CacheNode {
  return { kind: 'branch', range: arm, arm, parentIndex, size, blocks, children };
}

const logical = `import { bump, Child } from './counter.js';
export function Logical({ show, a }) {
  const el = show && <Child v={a} />;
  return <div>{el}</div>;
}
`;
const logicalArm = findRange(logical, '<Child v={a} />');

const guard = `import { bump, Child } from './counter.js';
export function Guard({ ok, a, b }) {
  if (ok) {
    return <b><Child v={a} /></b>;
  }
  return <i><Child v={b} /></i>;
}
`;

const pick = `import { bump, Child } from './counter.js';
export function Pick({ kind, a }) {
  switch (kind) {
    case 'a':
      return <Child v={a} />;
    default:
      return <em>none</em>;
  }
}
`;

const loop = `import { bump, Row } from './counter.js';
export function Loop({ items, title }) {
  const rows = [];
  for (const item of items) {
    rows.push(<Row key={item.id} item={item} />);
  }
  return <ul title={title}>{rows}</ul>;
}
`;
const loopBody = findRange(loop, '{\n    rows.push(');
const loopRows = findRange(loop, 'rows}</ul>');

const some = `import { bump, Row } from './counter.js';
export function Some({ items }) {
  return <ul>{items.map((item) => item.on ? <Row key={item.id} item={item} /> : null)}</ul>;
}
`;
const someBody = findRange(some, 'item.on ? <Row key={item.id} item={item} /> : null');
const someRow = findRange(some, '<Row key={item.id} item={item} />');

const arrow = `import { bump } from './counter.js';
function costly(v) { bump('costly'); return v * 2; }
export const Arrow = ({ a, b }) => <p>{costly(a)}-{b}</p>;
`;

const items = [
  { id: 1, name: 'n1', on: true },
  { id: 2, name: 'n2', on: false },
  { id: 3, name: 'n3', on: true },
];

const cases = [
  {
    name: 'logical branch',
    source: logical,
    names: ['show', 'a', 'el'],
    component: 'Logical',
    plan: createRoot(
      logical,
      'export function Logical',
      3,
      [
        createBlock(
          1,
          1,
          [2],
          findRange(logical, '<div>{el}</div>'),
          findRange(logical, 'return <div>'),
        ),
      ],
      [createBranch(logicalArm, 0, 2, [createBlock(0, 0, [1], logicalArm)])],
    ),
    steps: [
      { show: true, a: 1 },
      { show: true, a: 1 },
      { show: true, a: 2 },
      { show: false, a: 2 },
      { show: true, a: 2 },
    ],
    calls: ['branch($, 0, 2)'],
  },
  {
    name: 'if statement branch',
    source: guard,
    names: ['ok', 'a', 'b'],
    component: 'Guard',
    plan: createRoot(
      guard,
      'export function Guard',
      3,
      [
        createBlock(
          1,
          1,
          [2],
          findRange(guard, '<i><Child v={b} /></i>'),
          findRange(guard, 'return <i>'),
        ),
      ],
      [
        createBranch(findRange(guard, '{\n    return <b><Child v={a} /></b>;\n  }'), 0, 2, [
          createBlock(
            0,
            0,
            [1],
            findRange(guard, '<b><Child v={a} /></b>'),
            findRange(guard, '{\n    return <b><Child v={a} /></b>;\n  }'),
          ),
        ]),
      ],
    ),
    steps: [
      { ok: true, a: 1, b: 2 },
      { ok: true, a: 1, b: 3 },
      { ok: false, a: 1, b: 3 },
      { ok: false, a: 9, b: 3 },
      { ok: true, a: 1, b: 3 },
    ],
    calls: ['branch($, 0, 2)'],
  },
  {
    name: 'switch case branches',
    source: pick,
    names: ['kind', 'a'],
    component: 'Pick',
    plan: createRoot(
      pick,
      'export function Pick',
      2,
      [],
      [
        createBranch(findRange(pick, "case 'a':\n      return <Child v={a} />;"), 0, 2, [
          createBlock(0, 0, [1], findRange(pick, '<Child v={a} />')),
        ]),
        createBranch(findRange(pick, 'default:\n      return <em>none</em>;'), 1, 1, [
          createBlock(1, 0, [], findRange(pick, '<em>none</em>')),
        ]),
      ],
    ),
    steps: [
      { kind: 'a', a: 1 },
      { kind: 'a', a: 1 },
      { kind: 'b', a: 1 },
      { kind: 'b', a: 2 },
      { kind: 'a', a: 2 },
    ],
    calls: ['branch($, 0, 2)', 'branch($, 1, 1)', 'EMPTY'],
  },
  {
    name: 'for-of iteration with keep',
    source: loop,
    names: ['items', 'title', 'rows', 'item'],
    component: 'Loop',
    plan: createRoot(
      loop,
      'export function Loop',
      5,
      [
        {
          id: 1,
          kind: 'keep',
          first: 1,
          inputs: [],
          outputs: [{ range: { start: loopRows.start, end: loopRows.start + 4 }, local: 't1' }],
          at: findRange(loop, 'return <ul'),
        },
        {
          id: 2,
          kind: 'value',
          first: 2,
          inputs: [
            { kind: 'binding', id: 1 },
            { kind: 'output', block: 1, index: 0 },
          ],
          outputs: [{ range: findRange(loop, '<ul title={title}>{rows}</ul>'), local: 't2' }],
          at: findRange(loop, 'return <ul'),
        },
      ],
      [
        {
          kind: 'iteration',
          range: loopBody,
          body: { start: loopBody.start, end: findRange(loop, '}\n  return').start + 1 },
          size: 2,
          parentIndex: 0,
          indexLocal: 'i',
          blocks: [
            createBlock(0, 0, [3], findRange(loop, '<Row key={item.id} item={item} />'), loopBody),
          ],
          children: [],
        },
      ],
    ),
    steps: [
      { items, title: 't' },
      { items, title: 'u' },
      { items: [items[0], { id: 2, name: 'changed' }, items[2]], title: 'u' },
      { items: [...items, { id: 4, name: 'n4' }], title: 'u' },
      { items: [items[0]], title: 'u' },
    ],
    calls: ['branch($, 0, 0)', 'branch($1r, ++i, 2)', 'keep($, 1, rows)'],
  },
  {
    name: 'branch inside an iteration callback',
    source: some,
    names: ['items', 'item'],
    component: 'Some',
    plan: createRoot(
      some,
      'export function Some',
      1,
      [],
      [
        {
          kind: 'iteration',
          range: someBody,
          body: someBody,
          size: 1,
          parentIndex: 0,
          indexLocal: 'i',
          blocks: [],
          children: [createBranch(someRow, 0, 2, [createBlock(0, 0, [1], someRow)])],
        },
      ],
    ),
    steps: [
      { items },
      { items },
      { items: [items[0], { ...items[1], on: true }, items[2]] },
      { items: [items[2], items[0]] },
    ],
    calls: ['branch($1r, i, 1)', 'branch($1, 0, 2)'],
  },
  {
    name: 'arrow component with an expression body',
    source: arrow,
    names: ['a', 'b'],
    component: 'Arrow',
    plan: {
      unit: 0,
      root: {
        kind: 'root',
        range: findRange(arrow, 'export const Arrow = ({ a, b }) => <p>{costly(a)}-{b}</p>;'),
        size: 2,
        blocks: [createBlock(0, 0, [0], findRange(arrow, 'costly(a)'))],
        children: [],
      },
    } satisfies CachePlan,
    steps: [
      { a: 1, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 2 },
    ],
    calls: ['useCache(useRef, 2)'],
  },
];

describe.each(cases)('$name', (testCase) => {
  const emitted = emitPlan(testCase.source, testCase.plan, testCase.names);

  it('emits the runtime calls', () => {
    for (const call of testCase.calls) {
      expect(emitted).toContain(call);
    }
    expect(() => parseSync('out.jsx', emitted)).not.toThrow();
    expect(parseSync('out.jsx', emitted).errors).toEqual([]);
  });

  it('renders like uncompiled output with less work', async () => {
    const plain = await runSteps(
      await loadModule(testCase.source),
      testCase.component,
      testCase.steps,
    );
    const next = await runSteps(await loadModule(emitted), testCase.component, testCase.steps);
    expect(next.map((step) => step.html)).toEqual(plain.map((step) => step.html));

    let plainWork = 0;
    let nextWork = 0;
    for (const [position, step] of next.entries()) {
      for (const count of Object.values(step.counts)) {
        nextWork += count;
      }
      for (const count of Object.values(plain[position].counts)) {
        plainWork += count;
      }
    }
    expect(nextWork).toBeLessThan(plainWork);
  });
});

describe('emit', () => {
  const source = `'use client';
import { useRef as ref, useState } from 'react';
export function Box({ a }) {
  const [n] = useState(0);
  return <p>{a}{n}</p>;
}
`;
  const plan = createRoot(
    source,
    'export function Box',
    2,
    [createBlock(0, 0, [0], findRange(source, '<p>{a}{n}</p>'), findRange(source, 'return <p>'))],
    [],
  );

  function run(options: { sourceMap?: boolean } = {}): ReturnType<typeof emit> {
    return emit(
      {
        code: source,
        program: parseSync('box.jsx', source).program,
        bindings: [{ id: 0, name: 'a' }],
        plans: [plan],
      },
      {
        useRef: { kind: 'named', name: 'useRef', source: 'react' },
        filename: 'box.jsx',
        ...options,
      },
    );
  }

  it('reuses an imported useRef and keeps directives first', () => {
    const { code } = run();
    expect(code.startsWith("'use client';\nimport { useCache } from 'forgetti/runtime';\n")).toBe(
      true,
    );
    expect(code).toContain('useCache(ref, 2)');
    expect(code).not.toContain("import { useRef } from 'react'");
  });

  it('returns a source map from magic-string', () => {
    expect(run().map).toBeNull();
    const map = run({ sourceMap: true }).map;
    expect(map?.sources).toEqual(['box.jsx']);
    expect(map?.mappings.length).toBeGreaterThan(0);
  });

  it('renames runtime helpers that the module already uses', () => {
    const clash = `function useCache() {}\n${source}`;
    const shifted = createRoot(
      clash,
      'export function Box',
      2,
      [createBlock(0, 0, [0], findRange(clash, '<p>{a}{n}</p>'), findRange(clash, 'return <p>'))],
      [],
    );
    const { code } = emit(
      {
        code: clash,
        program: parseSync('box.jsx', clash).program,
        bindings: [{ id: 0, name: 'a' }],
        plans: [shifted],
      },
      { useRef: { kind: 'named', name: 'useRef', source: 'react' } },
    );
    expect(code).toContain('import { useCache as useCache1 }');
    expect(code).toContain('useCache1(ref, 2)');
  });

  it('refuses a block whose code would leave its closure', () => {
    const closure = `export function C({ a }) {\n  return <p onClick={() => f(a)} />;\n}\n`;
    const bad = createRoot(
      closure,
      'export function C',
      2,
      [createBlock(0, 0, [0], findRange(closure, 'f(a)'))],
      [],
    );
    expect(() =>
      emit(
        {
          code: closure,
          program: parseSync('c.jsx', closure).program,
          bindings: [{ id: 0, name: 'a' }],
          plans: [bad],
        },
        { useRef: { kind: 'named', name: 'useRef', source: 'react' } },
      ),
    ).toThrow(/function boundary/);
  });

  it('emits several units into one module', async () => {
    const two = `import { bump, Child } from './counter.js';
export function One({ a }) {
  return <p><Child v={a} /></p>;
}
export function Two({ b }) {
  return <q><Child v={b} /></q>;
}
`;
    const plans: CachePlan[] = [
      {
        unit: 0,
        root: {
          kind: 'root',
          range: findRange(
            two,
            'export function One({ a }) {\n  return <p><Child v={a} /></p>;\n}',
          ),
          size: 2,
          blocks: [
            createBlock(
              0,
              0,
              [0],
              findRange(two, '<p><Child v={a} /></p>'),
              findRange(two, 'return <p>'),
            ),
          ],
          children: [],
        },
      },
      {
        unit: 1,
        root: {
          kind: 'root',
          range: findRange(
            two,
            'export function Two({ b }) {\n  return <q><Child v={b} /></q>;\n}',
          ),
          size: 2,
          blocks: [
            createBlock(
              1,
              0,
              [1],
              findRange(two, '<q><Child v={b} /></q>'),
              findRange(two, 'return <q>'),
            ),
          ],
          children: [],
        },
      },
    ];
    const { code } = emit(
      {
        code: two,
        program: parseSync('two.jsx', two).program,
        bindings: [
          { id: 0, name: 'a' },
          { id: 1, name: 'b' },
        ],
        plans,
      },
      { useRef: { kind: 'named', name: 'useRef', source: 'react' }, runtime: RUNTIME },
    );
    expect(code.match(/useCache\(useRef, 2\)/g)).toHaveLength(2);
    expect(code.match(/^import /gm)).toHaveLength(3);

    const module = await loadModule(code);
    const steps = [
      { a: 1, b: 1 },
      { a: 1, b: 1 },
    ];
    const first = await runSteps(module, 'One', steps);
    const second = await runSteps(module, 'Two', steps);
    expect(first[1]).toEqual({ html: '<p><i>1</i></p>', counts: {} });
    expect(second[1]).toEqual({ html: '<q><i>1</i></q>', counts: {} });
  });
});
