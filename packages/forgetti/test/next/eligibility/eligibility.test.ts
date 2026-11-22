import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEligibility } from '../../../src/next/eligibility';
import type { Eligibility } from '../../../src/next/ir';
import { PRESETS, parseAndScope } from '../../../src/next/parse';

const CORPUS = join(import.meta.dirname, '../../../../../benchmarks/corpus/base');

function check(code: string, preset: 'react' | 'preact' = 'react'): Eligibility[] {
  const result = parseAndScope(code, { filename: 'input.jsx', preset });
  return checkEligibility(result, PRESETS[preset]);
}

function expectBail(code: string, reason: string, snippet: string): void {
  const [result] = check(code);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.reason).toBe(reason);
  expect(code.slice(result.range.start, result.range.end)).toContain(snippet);
  expect(result.message.length).toBeGreaterThan(0);
}

function expectOk(code: string): void {
  for (const result of check(code)) {
    expect(result).toMatchObject({ ok: true });
  }
}

describe('mutates-props', () => {
  it('bails on a field assignment', () => {
    expectBail(
      `export function A(props) { props.a = 1; return <div />; }`,
      'mutates-props',
      'props.a = 1',
    );
  });
  it('bails on a destructured prop that is changed', () => {
    expectBail(
      `export function A({ box }) { box.n += 1; return <div />; }`,
      'mutates-props',
      'box.n',
    );
  });
  it('bails on a mutating method', () => {
    expectBail(
      `export function A(props) { props.items.push(1); return <div />; }`,
      'mutates-props',
      'push',
    );
  });
  it('bails on an update and a delete', () => {
    expectBail(`export function A(p) { p.n++; return <div />; }`, 'mutates-props', 'p.n++');
    expectBail(`export function A(p) { delete p.n; return <div />; }`, 'mutates-props', 'delete');
  });
  it('bails on a mutation through an alias', () => {
    expectBail(
      `export function A(props) { const items = props.items; items.sort(); return <div />; }`,
      'mutates-props',
      'items.sort()',
    );
  });
  it('allows a copy that is then changed', () => {
    expectOk(
      `export function A(props) { const items = [...props.items]; items.push(1); const s = props.items.slice().sort(); return <div>{items}{s}</div>; }`,
    );
  });
  it('allows a rebind of the parameter name', () => {
    expectOk(`export function A({ n }) { n = 2; return <div>{n}</div>; }`);
  });
  it('bails on a write to props inside a nested function', () => {
    expectBail(
      `export function A(props) { props.items.forEach(() => { props.n = 1; }); return <div />; }`,
      'mutates-props',
      'props.n = 1',
    );
  });
  it('bails on Object.assign and Object.defineProperty on props', () => {
    expectBail(
      `export function A(props) { Object.assign(props, { a: 1 }); return <div />; }`,
      'mutates-props',
      'Object.assign',
    );
    expectBail(
      `export function A(props) { Object.defineProperty(props, 'a', { value: 1 }); return <div />; }`,
      'mutates-props',
      'Object.defineProperty',
    );
  });
  it('allows Object.assign on a copy', () => {
    expectOk(
      `export function A(props) { const o = Object.assign({}, props); return <div>{o.a}</div>; }`,
    );
  });
  it('treats a function declaration as a closure', () => {
    expectOk(
      `import { useState, useRef } from 'react';
export function A(props) {
  const r = useRef(null);
  function format(v) { if (v) { return String(v); } return ''; }
  function onClick() { r.current = {}; }
  const [x] = useState(0);
  return <div onClick={onClick}>{format(x)}</div>;
}`,
    );
    expectBail(
      `export function A(props) { function onClick() { props.items.push(1); } return <div onClick={onClick} />; }`,
      'mutates-props',
      'props.items.push(1)',
    );
  });
  it('does not leak watched names from one unit into a nested one', () => {
    const code = `import { useState } from 'react';
export function A() { const [s] = useState([]); function B(p) { return <div>{p.a}</div>; } return <div />; }`;
    expectOk(code);
  });
  it('allows a change to a local', () => {
    expectOk(`export function A(props) { const o = {}; o.a = props.a; return <div>{o.a}</div>; }`);
  });
});

describe('mutates-state', () => {
  const head = `import { useState } from 'react';\n`;
  it('bails on a change to the state value', () => {
    expectBail(
      `${head}export function A() { const [list, setList] = useState([]); list.push(1); return <div />; }`,
      'mutates-state',
      'list.push(1)',
    );
  });
  it('allows the setter and a copy', () => {
    expectOk(
      `${head}export function A() { const [list, setList] = useState([]); const next = [...list, 1]; return <button onClick={() => setList(next)} />; }`,
    );
  });
  it('bails on a change to state inside an event handler', () => {
    expectBail(
      `${head}export function A() { const [list] = useState([]); return <button onClick={() => list.push(1)} />; }`,
      'mutates-state',
      'list.push(1)',
    );
  });
});

describe('mutates-hook-argument', () => {
  it('bails on a change to a hook argument', () => {
    expectBail(
      `export function useThing(opts) { opts.count = 1; return opts; }`,
      'mutates-hook-argument',
      'opts.count = 1',
    );
  });
  it('allows reading a hook argument', () => {
    expectOk(`export function useThing(opts) { const n = opts.count + 1; return n; }`);
  });
});

describe('stores-fresh-in-ref', () => {
  const head = `import { useRef } from 'react';\n`;
  it('bails on a fresh object stored during render', () => {
    expectBail(
      `${head}export function A() { const ref = useRef(null); ref.current = { a: 1 }; return <div />; }`,
      'stores-fresh-in-ref',
      'ref.current = { a: 1 }',
    );
  });
  it('bails on a name that holds a fresh value', () => {
    expectBail(
      `${head}export function A(p) { const ref = useRef(null); const o = [p.a]; ref.current = o; return <div />; }`,
      'stores-fresh-in-ref',
      'ref.current = o',
    );
  });
  it('allows a stable value, and a fresh value stored in an effect', () => {
    expectOk(
      `import { useRef, useEffect } from 'react';
export function A(p) { const ref = useRef(0); ref.current = ref.current + 1; useEffect(() => { ref.current = { a: p.a }; }); return <div>{ref.current}</div>; }`,
    );
  });
});

describe('stores-fresh-in-module', () => {
  it('bails on a module variable', () => {
    expectBail(
      `let last = null;\nexport function A(p) { last = { a: p.a }; return <div />; }`,
      'stores-fresh-in-module',
      'last =',
    );
  });
  it('bails on a field of a module object and on a global', () => {
    expectBail(
      `const cache = {};\nexport function A(p) { cache.value = [p.a]; return <div />; }`,
      'stores-fresh-in-module',
      'cache.value',
    );
    expectBail(
      `export function A(p) { window.last = { a: p.a }; return <div />; }`,
      'stores-fresh-in-module',
      'window.last',
    );
  });
  it('bails on a fresh value pushed into a module array', () => {
    expectBail(
      `const all = [];\nexport function A(p) { all.push({ a: p.a }); return <div />; }`,
      'stores-fresh-in-module',
      'all.push',
    );
  });
  it('allows a stable value and a write from a closure', () => {
    expectOk(
      `let count = 0;\nexport function A(p) { count = p.a; const f = () => { count = { a: 1 }; }; return <div onClick={f} />; }`,
    );
  });
});

describe('returns-fresh-from-hook', () => {
  it('bails on a returned object that a closure changes later', () => {
    expectBail(
      `import { useEffect } from 'react';
export function useBox(a) { const box = { n: 0 }; useEffect(() => { box.n = a; }); return box; }`,
      'returns-fresh-from-hook',
      'box',
    );
  });
  it('bails when a nested function declaration changes the returned object', () => {
    expectBail(
      `export function useBox(a) { const box = { n: 0 }; function bump() { box.n = a; } setTimeout(bump); return box; }`,
      'returns-fresh-from-hook',
      'box',
    );
  });
  it('allows a returned object that nothing changes later', () => {
    expectOk(`export function useThing(a, b) { const x = a * 2; return { x, y: b }; }`);
  });
  it('allows a returned object that the hook changes during render', () => {
    expectOk(`export function useThing(a) { const o = {}; o.a = a; return o; }`);
  });
});

describe('conditional-hook', () => {
  const head = `import { useState, use, createContext } from 'react';\nconst Ctx = createContext(0);\n`;
  it('bails on useState in a branch', () => {
    expectBail(
      `${head}export function A({ f }) { if (f) { const [x] = useState(0); return <p>{x}</p>; } return <p />; }`,
      'conditional-hook',
      'useState(0)',
    );
  });
  it('allows use() in a branch', () => {
    expectOk(
      `${head}export function A({ f }) { if (f) { const v = use(Ctx); return <p>{v}</p>; } return <p />; }`,
    );
  });
  it('bails in a loop, a ternary arm and a logical right side', () => {
    expectBail(
      `${head}export function A({ n }) { for (let i = 0; i < n; i++) { useState(i); } return <p />; }`,
      'conditional-hook',
      'useState(i)',
    );
    expectBail(
      `${head}export function A({ f }) { const x = f ? useState(0) : null; return <p />; }`,
      'conditional-hook',
      'useState(0)',
    );
    expectBail(
      `${head}export function A({ f }) { const x = f && useState(0); return <p />; }`,
      'conditional-hook',
      'useState(0)',
    );
  });
  it('allows use() in a loop and in a ternary', () => {
    expectOk(
      `${head}export function A({ items, f }) { const a = []; for (const i of items) { a.push(use(i)); } const b = f ? use(Ctx) : 0; return <p>{b}</p>; }`,
    );
  });
  it('bails on a hook after an early return', () => {
    expectBail(
      `${head}export function A({ f }) { if (f) return null; const [x] = useState(0); return <p>{x}</p>; }`,
      'conditional-hook',
      'useState(0)',
    );
  });
  it('bails on a namespace hook in a branch and allows React.use', () => {
    expectBail(
      `import * as React from 'react';\nexport function A({ f }) { if (f) { React.useState(0); } return <p />; }`,
      'conditional-hook',
      'React.useState(0)',
    );
    expectOk(
      `import * as React from 'react';\nconst C = React.createContext(0);\nexport function A({ f }) { if (f) { React.use(C); } return <p />; }`,
    );
  });
  it('allows hooks at the top level and inside a callback', () => {
    expectOk(
      `${head}export function A() { const [x] = useState(0); const f = () => { if (x) { return 1; } }; return <p onClick={f}>{x}</p>; }`,
    );
  });
  it('treats a custom hook in a branch as conditional', () => {
    expectBail(
      `export function A({ f }) { if (f) { useX(); } return <p />; }\nfunction useX() { return 1; }`,
      'conditional-hook',
      'useX()',
    );
  });
});

describe('result shape', () => {
  it('reports one entry per unit, in unit order, and the first problem in source order', () => {
    const code = `export function A(p) { p.a = 1; p.b.push(1); return <div />; }
export function B() { return <div />; }`;
    const results = check(code);
    expect(results.map((r) => r.unit)).toEqual([0, 1]);
    expect(results[0]).toMatchObject({ ok: false, reason: 'mutates-props' });
    expect(results[1]).toEqual({ unit: 1, ok: true });
    const [first] = results;
    if (!first.ok) {
      expect(first.range.start).toBe(code.indexOf('p.a = 1'));
    }
  });
  it('does not report escaping-closure, which ownership owns', () => {
    expectOk(
      `export function A(p) { const o = {}; const f = () => o.a; o.b = f; return <div />; }`,
    );
  });
  it('works with the preact preset', () => {
    const results = check(
      `import { useState } from 'preact/hooks';\nexport function A({ f }) { if (f) { useState(0); } return <p />; }`,
      'preact',
    );
    expect(results[0]).toMatchObject({ ok: false, reason: 'conditional-hook' });
  });
});

describe('base corpus', () => {
  for (const name of readdirSync(CORPUS)) {
    it(`${name} ${name === 'bailout' ? 'bails with mutates-props' : 'is eligible'}`, () => {
      const code = readFileSync(join(CORPUS, name, 'input.jsx'), 'utf8');
      const results = check(code);
      expect(results.length).toBeGreaterThan(0);
      if (name === 'bailout') {
        expect(results.find((result) => !result.ok)).toMatchObject({ reason: 'mutates-props' });
      } else {
        for (const result of results) {
          expect(result).toMatchObject({ ok: true });
        }
      }
    });
  }
});
