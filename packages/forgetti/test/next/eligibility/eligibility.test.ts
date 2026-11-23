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

describe('writes to hook results', () => {
  const head = `import { useContext, useMemo, useRef } from 'react';\nimport { useStore, useLatest } from './hooks';\n`;
  it('bails on a write to a custom hook result', () => {
    expectBail(
      `${head}export function A() { const store = useStore(); store.count = 1; return <div />; }`,
      'mutates-state',
      'store.count = 1',
    );
  });
  it('bails on a mutating method inside a handler', () => {
    expectBail(
      `${head}export function A() { const items = useStore(); return <button onClick={() => items.push(1)} />; }`,
      'mutates-state',
      'items.push(1)',
    );
  });
  it('bails on a write to a destructured hook result', () => {
    expectBail(
      `${head}export function A() { const { box } = useStore(); box.n += 1; return <div />; }`,
      'mutates-state',
      'box.n',
    );
  });
  it('bails on a write to a context value and a memo value', () => {
    expectBail(
      `${head}export function A() { const c = useContext(C); c.n = 1; return <div />; }`,
      'mutates-state',
      'c.n = 1',
    );
    expectBail(
      `${head}export function A() { const m = useMemo(() => [], []); m.push(1); return <div />; }`,
      'mutates-state',
      'm.push(1)',
    );
  });
  it('allows a .current write on a hook result', () => {
    expectOk(
      `${head}export function A(p) { const latest = useLatest(); latest.current = p.a; return <div />; }`,
    );
  });
  it('allows a read-only handler', () => {
    expectOk(
      `${head}export function A() { const store = useStore(); return <button onClick={() => console.log(store.count)} />; }`,
    );
  });
});

describe('instances kept in state', () => {
  const head = `import { useState } from 'react';\n`;
  it('bails on a method that changes a kept instance (known false bailout)', () => {
    expectBail(
      `${head}export function A() { const [store] = useState(() => new Store()); return <button onClick={() => store.add(1)} />; }`,
      'mutates-state',
      'store.add(1)',
    );
  });
  it('bails on a field write to a kept instance (known false bailout)', () => {
    expectBail(
      `${head}export function A() { const [store] = useState(() => new Store()); return <button onClick={() => { store.count = 1; }} />; }`,
      'mutates-state',
      'store.count = 1',
    );
  });
  it('allows a read-only handler on a kept instance', () => {
    expectOk(
      `${head}export function A() { const [store] = useState(() => new Store()); return <button onClick={() => console.log(store.size)} />; }`,
    );
  });
});

describe('writes below a spread copy', () => {
  const head = `import { useState } from 'react';\n`;
  it('bails on an element of a prop copied by spread', () => {
    expectBail(
      `export function A(props) { const copy = [...props.items]; copy[0].x = 1; return <div />; }`,
      'mutates-props',
      'copy[0].x = 1',
    );
  });
  it('bails on a mutating method of an element', () => {
    expectBail(
      `export function A({ items }) { const copy = [...items]; copy[0].tags.push(1); return <div />; }`,
      'mutates-props',
      'push',
    );
  });
  it('bails on an object spread copy of props', () => {
    expectBail(
      `export function A(props) { const copy = { ...props }; copy.box.n = 1; return <div />; }`,
      'mutates-props',
      'copy.box.n = 1',
    );
  });
  it('bails on an element of a state copy', () => {
    expectBail(
      `${head}export function A() { const [list] = useState([]); const copy = [...list]; copy[0].x = 1; return <div />; }`,
      'mutates-state',
      'copy[0].x = 1',
    );
  });
  it('bails on an element reached through an alias of the copy', () => {
    expectBail(
      `export function A(props) { const copy = [...props.items]; const first = copy[0]; first.x = 1; return <div />; }`,
      'mutates-props',
      'first.x = 1',
    );
  });
  it('allows writes to the copy itself', () => {
    expectOk(
      `export function A(props) { const copy = [...props.items]; copy[0] = 1; copy.push(2); copy.sort(); return <div>{copy.length}</div>; }`,
    );
  });
  it('allows reading elements of the copy', () => {
    expectOk(
      `export function A(props) { const copy = [...props.items]; const n = copy[0].x; return <div>{n}</div>; }`,
    );
  });
});

describe('writes below other derived values', () => {
  const head = `import { useState } from 'react';\nimport { useStore } from './hooks';\n`;
  const bail = (body: string, reason = 'mutates-props', snippet = ''): void => {
    expectBail(`${head}export function A(p) { ${body} return <div />; }`, reason, snippet);
  };
  const ok = (body: string): void => {
    expectOk(`${head}export function A(p) { ${body} return <div />; }`);
  };
  it('bails below a slice, concat, Array.from or Object.assign copy', () => {
    bail('const c = p.items.slice(); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = p.items.concat([]); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = Array.from(p.items); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = Object.assign({}, p); c.box.n = 1;', 'mutates-props', 'c.box.n = 1');
  });
  it('bails below map, filter and nested copies', () => {
    bail('const c = p.items.map((x) => x); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = [...p.items.filter(Boolean)]; c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = [...p.items]; const d = c.slice(); d[0].x = 1;', 'mutates-props', 'd[0].x = 1');
  });
  it('bails on elements handed out by a loop or a callback', () => {
    bail('const c = [...p.items]; for (const i of c) { i.x = 1; }', 'mutates-props', 'i.x = 1');
    bail('const c = [...p.items]; c.forEach((i) => { i.x = 1; });', 'mutates-props', 'i.x = 1');
    bail('p.items.forEach((i) => { i.x = 1; });', 'mutates-props', 'i.x = 1');
  });
  it('bails on a late assignment', () => {
    bail('let c = []; c = [...p.items]; c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('let c; c = p.box; c.n = 1;', 'mutates-props', 'c.n = 1');
  });
  it('bails on values that may be a prop itself', () => {
    bail('const f = p.items.find(Boolean); f.x = 1;', 'mutates-props', 'f.x = 1');
    bail('const b = p.box || {}; b.n = 1;', 'mutates-props', 'b.n = 1');
    bail('const o = { a: p.box }; o.a.n = 1;', 'mutates-props', 'o.a.n = 1');
  });
  it('bails below a copy of a custom hook result', () => {
    expectBail(
      `${head}export function A() { const s = useStore(); const c = [...s]; c[0].x = 1; return <div />; }`,
      'mutates-state',
      'c[0].x = 1',
    );
  });
  it('allows writes to the derived copy itself', () => {
    ok('const c = p.items.slice(); c[0] = 1; c.push(2); c.sort();');
    ok('const c = p.items.map((x) => x.id); c[0] = 1; c.reverse();');
    ok('let c = []; c = [...p.items]; c.push(1);');
    ok('const c = Object.assign({}, p); c.extra = 1;');
  });
  it('bails on a write that starts at an expression', () => {
    bail('getBox(p).n = 1;', 'mutates-props', 'getBox(p).n = 1');
    bail('p.items.find(Boolean).x = 1;', 'mutates-props', 'x = 1');
    bail('(p.a || p.b).x = 1;', 'mutates-props', 'x = 1');
    bail('(p.a ? p.b : p.c).x = 1;', 'mutates-props', 'x = 1');
    bail('(() => p.box)().n = 1;', 'mutates-props', 'n = 1');
    bail('p.items.slice()[0].x = 1;', 'mutates-props', 'x = 1');
    bail('getBox(p).list.push(1);', 'mutates-props', 'push');
    bail('Object.assign(getBox(p), { n: 1 });', 'mutates-props', 'Object.assign');
    bail('useEffect(() => { p.items.slice()[0].x = 1; });', 'mutates-props', 'x = 1');
  });
  it('bails on a call to a local function that closes over a watched name', () => {
    bail('const get = () => p.items; get()[0].x = 1;', 'mutates-props', 'x = 1');
    bail('const get = function () { return p.box; }; get().n = 1;', 'mutates-props', 'n = 1');
    bail('const f = () => p.box; f().n = 1;', 'mutates-props', 'n = 1');
    bail('function f() { return p.box; } const b = f(); b.n = 1;', 'mutates-props', 'b.n = 1');
  });
  it('allows a reduce accumulator that starts fresh', () => {
    ok('const m = p.items.reduce((acc, i) => { acc[i.id] = i; return acc; }, {}); m.extra = 1;');
    ok('const l = p.items.reduce((acc, i) => { acc.push(i.id); return acc; }, []); l.push(1);');
    bail(
      'const m = p.items.reduce((acc, i) => { acc.x = i; return acc; }, p.seed);',
      'mutates-props',
      'acc.x = i',
    );
    bail('const r = p.items.reduce((acc, i) => acc); r.x = 1;', 'mutates-props', 'r.x = 1');
    bail('const m = p.items.reduce((a, i) => a, {}); m.k.x = 1;', 'mutates-props', 'm.k.x = 1');
  });
  it('keeps a sorted copy a copy', () => {
    ok('const c = [...p.items].sort(); c.push(1);');
    ok('const c = p.items.slice().sort((a, b) => a - b).reverse(); c.push(1); c[0] = 2;');
    bail('const c = [...p.items].sort(); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
    bail('const c = p.items.slice().reverse(); c[0].x = 1;', 'mutates-props', 'c[0].x = 1');
  });
  it('allows results that are always fresh', () => {
    ok('const a = p.text.split(","); a.push("x"); a[0] = "y";');
    ok('const o = JSON.parse(p.text); o.x = 1;');
    ok('const o = Object.create(p.proto); o.x = 1;');
    ok('const s = String(p.n); const n = Number(p.n); const d = new Date(p.t); d.x = 1;');
    ok('const o = Object.fromEntries(p.entries); o.x = 1; o.y = 2;');
    ok('const m = new Map(p.entries); m.set(1, 2);');
  });
  it('keeps unknown user calls watched', () => {
    bail('const a = getArr(p.x); a.push(1);', 'mutates-props', 'a.push(1)');
    bail('const o = Object.fromEntries(p.entries); o.k.x = 1;', 'mutates-props', 'o.k.x = 1');
    bail('const m = new Store(p.x); m.n = 1;', 'mutates-props', 'm.n = 1');
  });
  it('bails below a local that was given a watched value', () => {
    bail('const o = {}; o.a = p.box; o.a.n = 1;', 'mutates-props', 'o.a.n = 1');
    bail('const o = {}; o[p.k] = p.box; o.x.n = 1;', 'mutates-props', 'o.x.n = 1');
    bail('const l = []; l.push(p.box); l[0].n = 1;', 'mutates-props', 'l[0].n = 1');
    bail('const m = new Map(); m.set(1, p.box); m.get(1).n = 1;', 'mutates-props', 'n = 1');
    bail('const o = {}; Object.assign(o, p); o.box.n = 1;', 'mutates-props', 'o.box.n = 1');
    bail(
      'const g = {}; g.list = []; g.list.push(p.box); g.list[0].n = 1;',
      'mutates-props',
      'n = 1',
    );
    bail('const o = { get: () => p.box }; o.get().n = 1;', 'mutates-props', 'n = 1');
  });
  it('allows stores of fresh values and writes to the container', () => {
    ok('const o = {}; o.a = 1; o.b = {}; o.b.n = 1; o.a = 2;');
    ok('const l = []; l.push(p.box); l.push(2); l[0] = 3; l.sort();');
    ok('const g = {}; g.list = []; g.list.push(p.box); g.list.push(2);');
    ok('const o = { get: () => 1 }; o.get().n = 1;');
  });
  it('bails on a call whose callee or arguments are watched', () => {
    bail('const get = makeGetter(p); get().n = 1;', 'mutates-props', 'n = 1');
    bail('run(() => p.box).n = 1;', 'mutates-props', 'n = 1');
    bail('const b = run(() => p.box); b.n = 1;', 'mutates-props', 'b.n = 1');
    bail('const b = p.pick(); b.n = 1;', 'mutates-props', 'b.n = 1');
    ok('const b = run(() => 1); b.n = 1;');
  });
  it('judges a reassigned local function by every body it may hold', () => {
    bail('let f = () => 1; f = () => p.box; f().n = 1;', 'mutates-props', 'n = 1');
    bail('let f = () => p.box; f = () => 1; f().n = 1;', 'mutates-props', 'n = 1');
    ok('let f = () => 1; f = () => 2; f().n = 1;');
  });
  it('treats a shadowed global as user code', () => {
    bail(
      'const JSON = { parse: (x) => x }; const o = JSON.parse(p.box); o.n = 1;',
      'mutates-props',
      'o.n = 1',
    );
    bail('const String = (x) => x; const o = String(p.box); o.n = 1;', 'mutates-props', 'o.n = 1');
    bail(
      'const Date = class { constructor(x) { return x; } }; const d = new Date(p.box); d.n = 1;',
      'mutates-props',
      'd.n = 1',
    );
    ok('const o = JSON.parse(p.t); o.n = 1; const d = new Date(p.t); d.n = 1;');
  });
  it('classifies locals declared inside handlers and callbacks', () => {
    bail(
      'const h = () => { const it = p.items.find((i) => i.id === 1); it.sel = true; };',
      'mutates-props',
      'it.sel = true',
    );
    bail('const h = () => { const it = p.items[0]; it.sel = true; };', 'mutates-props', 'it.sel');
    bail('const h = () => { const { box } = p; box.x = 1; };', 'mutates-props', 'box.x = 1');
    bail(
      'useEffect(() => { const it = p.items.find(Boolean); it.x = 1; });',
      'mutates-props',
      'it.x = 1',
    );
    bail('useCallback(() => { const it = p.box; it.x = 1; }, []);', 'mutates-props', 'it.x = 1');
    bail(
      'const s = useStore(); const h = () => { const it = s.items[0]; it.x = 1; };',
      'mutates-state',
      'it.x = 1',
    );
    bail(
      'const [items] = useState([]); const h = () => { const it = items.find(Boolean); it.done = true; };',
      'mutates-state',
      'it.done = true',
    );
  });
  it('allows locals declared inside handlers when nothing is shared', () => {
    ok('const o = {}; const h = () => { const it = o; it.x = 1; };');
    ok('const h = (item) => { item.x = 1; };');
    ok('const h = () => { const c = p.items.slice(); c.push(1); c[0] = 2; };');
    ok('const h = () => { const it = {}; it.x = 1; const p = {}; p.y = 2; };');
  });
  it('allows grouping into a fresh container', () => {
    ok('const g = {}; for (const i of p.items) { (g[i.k] ||= []).push(i); }');
    ok('const g = {}; for (const i of p.items) { g[i.k] = g[i.k] || []; g[i.k].push(i); }');
    ok(
      'const g = {}; for (const i of p.items) { const k = i.k; g[k] = g[k] ?? []; g[k].push(i); }',
    );
    ok(
      'const m = new Map(); for (const i of p.items) { const l = m.get(i.k) ?? []; l.push(i); m.set(i.k, l); }',
    );
    ok(
      'const m = new Map(); for (const i of p.items) { if (!m.has(i.k)) m.set(i.k, []); m.get(i.k).push(i); }',
    );
  });
  it('bails on a write at the depth where the grouped value lives', () => {
    const loop = 'for (const i of p.items) { (g[i.k] ||= []).push(i); }';
    bail(`const g = {}; ${loop} g.a[0].x = 1;`, 'mutates-props', 'g.a[0].x = 1');
    bail(
      'const g = {}; for (const i of p.items) { g[i.k] = g[i.k] || []; g[i.k].push(i); } g.a[0].n = 1;',
      'mutates-props',
      'g.a[0].n = 1',
    );
    bail('const g = {}; g.a = p.box; g.a.n = 1;', 'mutates-props', 'g.a.n = 1');
    bail(
      'const m = new Map(); for (const i of p.items) { if (!m.has(i.k)) m.set(i.k, []); m.get(i.k).push(i); } m.get(1)[0].n = 1;',
      'mutates-props',
      'n = 1',
    );
    bail(
      'const m = new Map(); for (const i of p.items) { const l = m.get(i.k) ?? []; l.push(i); m.set(i.k, l); } m.get(1)[0].n = 1;',
      'mutates-props',
      'n = 1',
    );
    bail('const o = {}; o.a = p.box; o[p.k].n = 1;', 'mutates-props', 'o[p.k].n = 1');
  });
  it('tracks which field of a literal shares objects', () => {
    bail('const i = [p.a]; const b = { i, t: p.t }; b.t.x = 1;', 'mutates-props', 'b.t.x = 1');
    ok('const i = [p.a]; const b = { i, t: p.t }; b.i.push(p.b);');
  });
  it('allows reads and writes to unrelated values', () => {
    ok('const c = p.items.slice(); for (const i of c) { console.log(i.x); }');
    ok('const o = { a: 1 }; o.a = 2; const l = [1]; for (const i of l) { l[0] = i; }');
    ok('const c = structuredClone(p.box); c.n = 1;');
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
