import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OwnershipReport } from '../../../src/next/ownership';
import { analyzeOwnership } from '../../../src/next/ownership';
import type { ParseResult } from '../../../src/next/parse';
import { parseAndScope } from '../../../src/next/parse';

const TUNING = join(import.meta.dirname, '../../../../../benchmarks/corpus/tuning');

interface ReadableGroup {
  members: string[];
  created: string[];
  /** Mutation text, then the kind of scope it runs in. */
  mutations: [string, string][];
  /** The source text that ends at `frozenAt`. */
  frozenAfter: string;
  inputs: string[];
}

interface Readable {
  groups: ReadableGroup[];
  opaque: string[];
  bailout?: { reason: string; text: string };
}

function analyze(code: string): { scope: ParseResult; report: OwnershipReport } {
  const scope = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
  return { scope, report: analyzeOwnership(scope, scope.units[0].id) };
}

/** Turns ids and ranges into names and source text, so expectations read like the code. */
function read(code: string, tail = 12): Readable {
  const { scope, report } = analyze(code);
  const names = (ids: number[]): string[] => ids.map((id) => scope.bindings[id].name);
  const text = (range: { start: number; end: number }): string =>
    code.slice(range.start, range.end);
  const result: Readable = {
    groups: report.groups.map((group) => ({
      members: names(group.members),
      created: group.created.map(text),
      mutations: group.mutations.map((mutation) => [
        text(mutation.range),
        scope.scopes[mutation.scope].kind,
      ]),
      frozenAfter: code.slice(Math.max(0, group.frozenAt - tail), group.frozenAt),
      inputs: names(group.inputs),
    })),
    opaque: names(report.opaque),
  };
  if (report.bailout) {
    result.bailout = {
      reason: report.bailout.reason,
      text: text(report.bailout.range),
    };
  }
  return result;
}

function readTuning(name: string): Readable {
  return read(readFileSync(join(TUNING, name, 'input.jsx'), 'utf8'));
}

describe('fresh values', () => {
  it('makes one group per fresh literal, closure and JSX value', () => {
    const result = read(`function A({ a, onPick }) {
  const list = [a];
  const box = { a };
  const pick = () => onPick(a);
  const el = <b>{a}</b>;
  return <div>{list.length}{box.a}{el}<i onClick={pick} /></div>;
}`);
    expect(result.groups.map((group) => group.members)).toEqual([
      ['list'],
      ['box'],
      ['pick'],
      ['el'],
    ]);
    expect(result.groups[2].inputs).toEqual(['a', 'onPick']);
    expect(result.bailout).toBeUndefined();
  });

  it('gives a call result no group', () => {
    const result = read(`function A({ a, pick }) {
  const v = pick(a);
  const w = v;
  return <p>{w}</p>;
}`);
    expect(result.groups).toEqual([]);
  });

  it('freezes a group with no mutation where its value is stored', () => {
    const result = read(`function A({ a }) {
  const box = { a };
  return <p>{box.a}</p>;
}`);
    expect(result.groups[0].frozenAfter.endsWith('{ a }')).toBe(true);
    expect(result.groups[0].mutations).toEqual([]);
  });
});

describe('joins', () => {
  it('joins on assignment, both at a declaration and later', () => {
    const result = read(`function A({ a }) {
  const arr = [a];
  const x = arr;
  let y;
  y = x;
  return <p>{y.length}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toEqual(['arr', 'x', 'y']);
    // A rebind of a member counts as a mutation.
    expect(result.groups[0].mutations).toEqual([['y = x', 'unit']]);
  });

  it('joins on a store into a field', () => {
    const result = read(`function A({ a }) {
  const inner = [a];
  const box = {};
  box.items = inner;
  return <p>{box.items.length}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toEqual(['inner', 'box']);
    expect(result.groups[0].mutations).toEqual([['box.items = inner', 'unit']]);
  });

  it('joins on a store into an array element', () => {
    const result = read(`function A({ a }) {
  const item = { a };
  const list = [];
  list[0] = item;
  return <p>{list.length}</p>;
}`);
    expect(result.groups[0].members).toEqual(['item', 'list']);
    expect(result.groups[0].created).toEqual(['{ a }', '[]']);
  });

  it('joins on Map.set and Set.add', () => {
    const result = read(`function A({ a, k }) {
  const map = new Map();
  const set = new Set();
  const item = { a };
  const other = [a];
  map.set(k, item);
  set.add(other);
  return <p>{map.size}{set.size}</p>;
}`);
    expect(result.groups.map((group) => group.members)).toEqual([
      ['map', 'item'],
      ['set', 'other'],
    ]);
    expect(result.groups[0].mutations).toEqual([['map.set(k, item)', 'unit']]);
    expect(result.groups[0].inputs).toEqual(['a', 'k']);
  });

  it('joins a closure with what it captures, and its call is a mutation', () => {
    const result = read(`function A({ a }) {
  const out = [];
  const add = () => { out.push(a); };
  add();
  return <p>{out.length}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toEqual(['out', 'add']);
    expect(result.groups[0].mutations).toEqual([['add()', 'unit']]);
    expect(result.groups[0].inputs).toEqual(['a']);
  });

  it('joins a hoisted function declaration with what it captures', () => {
    const result = read(`function A({ a }) {
  const out = [];
  add();
  function add() { out.push(a); }
  return <p>{out.length}</p>;
}`);
    expect(result.groups[0].members).toEqual(['out', 'add']);
    expect(result.groups[0].mutations).toEqual([['add()', 'unit']]);
  });

  it('joins a destructured part with its source', () => {
    const result = read(`function A({ a }) {
  const box = { items: [a] };
  const { items } = box;
  items.push(1);
  return <p>{box.items.length}</p>;
}`);
    expect(result.groups[0].members).toEqual(['box', 'items']);
    expect(result.groups[0].created).toEqual(['{ items: [a] }', '[a]']);
  });

  it('starts a new group for a spread copy of a prop', () => {
    const result = read(`function A({ list, extra }) {
  const copy = [...list];
  copy.push(extra);
  const obj = { ...extra };
  return <p>{copy.length}{obj.x}</p>;
}`);
    expect(result.groups.map((group) => group.members)).toEqual([['copy'], ['obj']]);
    expect(result.groups[0].inputs).toEqual(['list', 'extra']);
  });

  it('joins a fresh array source with its spread copy, which shares its items', () => {
    const result = read(`function A({ v }) {
  const a = [{ x: v }];
  const label = a[0].x;
  const b = [...a];
  b[0].x = 1;
  return <p>{label}{a[0].x}{b.length}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    // A member read may alias, so `label` joins too.
    expect(result.groups[0].members).toEqual(['a', 'label', 'b']);
    expect(result.groups[0].mutations).toEqual([['b[0].x = 1', 'unit']]);
    expect(result.groups[0].frozenAfter.endsWith('b[0].x = 1')).toBe(true);
  });

  it('joins a fresh object source with its spread copy', () => {
    const result = read(`function A({ n }) {
  const a = { inner: { n } };
  const b = { ...a };
  b.inner.n = 2;
  return <p>{a.inner.n}{b.inner.n}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toEqual(['a', 'b']);
    expect(result.groups[0].mutations).toEqual([['b.inner.n = 2', 'unit']]);
  });

  it('joins the arms of a conditional', () => {
    const result = read(`function A({ a, flag }) {
  const x = [a];
  const y = { a };
  const pick = flag ? x : y;
  return <p>{pick.length}</p>;
}`);
    expect(result.groups[0].members).toEqual(['x', 'y', 'pick']);
    expect(result.groups[0].inputs).toEqual(['a', 'flag']);
  });
});

describe('calls', () => {
  it('treats an unknown call that receives a fresh value as a mutation, not a bailout', () => {
    const result = read(`function A({ a, b, grow }) {
  const arr = [a];
  const n = grow(arr, b);
  return <p>{n}{arr.length}</p>;
}`);
    expect(result.bailout).toBeUndefined();
    expect(result.groups[0].members).toEqual(['arr', 'n']);
    expect(result.groups[0].mutations).toEqual([['grow(arr, b)', 'unit']]);
  });

  it('joins every fresh value one unknown call receives', () => {
    const result = read(`function A({ a, link }) {
  const x = [a];
  const y = { a };
  link(x, y);
  return <p>{x.length}{y.a}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].members).toEqual(['x', 'y']);
  });

  it('does not count read methods or pure globals as mutations', () => {
    const result = read(`function A({ a }) {
  const arr = [a];
  const text = arr.join(',');
  const json = JSON.stringify(arr);
  const size = Math.max(arr.length, 1);
  console.log(arr);
  return <p>{text}{json}{size}</p>;
}`);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].mutations).toEqual([]);
  });

  it('counts a mutating method as a mutation', () => {
    const result = read(`function A({ a }) {
  const arr = [a];
  arr.sort();
  arr.reverse();
  return <p>{arr.length}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([
      ['arr.sort()', 'unit'],
      ['arr.reverse()', 'unit'],
    ]);
  });

  it('counts a field write, an update and a delete as mutations', () => {
    const result = read(`function A({ a }) {
  const box = { n: a };
  box.n += 1;
  box.n++;
  delete box.n;
  return <p>{box.n}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([
      ['box.n += 1', 'unit'],
      ['box.n++', 'unit'],
      ['delete box.n', 'unit'],
    ]);
  });

  it('calls a callback given to forEach or map now, so the call mutates its captures', () => {
    const result = read(`function A({ list }) {
  const out = [];
  list.forEach((v) => { out.push(v); });
  return <p>{out.length}</p>;
}`);
    expect(result.bailout).toBeUndefined();
    expect(result.groups[0].mutations).toEqual([['list.forEach((v) => { out.push(v); })', 'unit']]);
  });

  it('does not count a read-only callback as a mutation', () => {
    const result = read(`function A({ a }) {
  const items = [a];
  const labels = items.map((item) => <i>{item}</i>);
  return <p>{labels}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([]);
  });

  it('counts a callback that writes through its parameter as a mutation of the receiver', () => {
    const result = read(`function A({ a }) {
  const items = [{ n: a }];
  items.forEach((item) => { item.n++; });
  return <p>{items[0].n}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([
      ['items.forEach((item) => { item.n++; })', 'unit'],
    ]);
  });

  it('counts a module function given as the callback as a mutation of the receiver', () => {
    const result = read(`function bump(i) { i.n++; }
function A({ v }) {
  const items = [{ n: v }];
  items.push({ n: 0 });
  items.forEach(bump);
  return <p>{items[0].n}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([
      ['items.push({ n: 0 })', 'unit'],
      ['items.forEach(bump)', 'unit'],
    ]);
    expect(result.groups[0].frozenAfter.endsWith('Each(bump)')).toBe(true);
  });

  it('counts a prop or member given as the callback as a mutation of the receiver', () => {
    const result = read(`function A({ v, onItem, api }) {
  const items = [{ n: v }];
  items.forEach(onItem);
  items.map(api.fix);
  return <p>{items.length}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([
      ['items.forEach(onItem)', 'unit'],
      ['items.map(api.fix)', 'unit'],
    ]);
  });

  it('does not count a pure global given as the callback', () => {
    const result = read(`function A({ v }) {
  const items = [v];
  items.forEach(console.log);
  const texts = items.map(String);
  return <p>{texts.length}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([]);
  });

  it('counts the initial value of reduce as mutated', () => {
    const result = read(`function A({ list }) {
  const out = [];
  list.reduce((acc, v) => { acc.push(v); return acc; }, out);
  return <p>{out.length}</p>;
}`);
    expect(result.groups[0].mutations).toHaveLength(1);
  });

  it('gives a hook result no group, and its fresh argument is mutated there', () => {
    const result = read(`import { useState } from 'react';
function A({ a }) {
  const init = { a };
  const [state] = useState(init);
  const arr = [state];
  return <p>{arr.length}</p>;
}`);
    expect(result.groups.map((group) => group.members)).toEqual([['init'], ['arr']]);
    expect(result.groups[0].mutations).toEqual([['useState(init)', 'unit']]);
    expect(result.groups[1].inputs).toEqual(['state']);
  });
});

describe('freeze point', () => {
  it('extends a mutation in a loop to the end of the loop', () => {
    const result = read(`function A({ list }) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    out.push(list[i]);
  }
  return <p>{out.length}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([['out.push(list[i])', 'block']]);
    expect(result.groups[0].frozenAfter.endsWith('i]);\n  }')).toBe(true);
    expect(result.groups[0].inputs).toEqual(['list']);
  });

  it('does not extend through a loop that holds the whole group', () => {
    const result = read(`function A({ list }) {
  let total = 0;
  for (const item of list) {
    const row = [item];
    row.push(1);
    total += row.length;
  }
  return <p>{total}</p>;
}`);
    expect(result.groups[0].members).toEqual(['row']);
    expect(result.groups[0].frozenAfter.endsWith('row.push(1)')).toBe(true);
    expect(result.groups[0].inputs).toEqual(['item']);
  });

  it('does not extend a mutation in a branch', () => {
    const result = read(`function A({ a, flag }) {
  const out = [a];
  if (flag) { out.push(1); }
  return <p>{out.length}</p>;
}`);
    expect(result.groups[0].mutations).toEqual([['out.push(1)', 'branch']]);
    expect(result.groups[0].frozenAfter.endsWith('out.push(1)')).toBe(true);
  });
});

describe('inputs', () => {
  it('adds the condition of a mutation that runs only sometimes', () => {
    const result = read(`function A({ a, b, flag }) {
  const out = [a];
  flag && out.push(b);
  return <p>{out.length}</p>;
}`);
    expect(result.groups[0].inputs).toEqual(['a', 'b', 'flag']);
  });

  it('ignores a condition around the whole group', () => {
    const result = read(`function A({ a, flag }) {
  if (flag) {
    const out = [a];
    out.push(1);
    return <p>{out.length}</p>;
  }
  return null;
}`);
    expect(result.groups[0].inputs).toEqual(['a']);
  });

  it('traces a call-free const back to the props it reads', () => {
    const result = read(`function A(props) {
  const k = props.n + 1;
  const arr = [k];
  return <p>{arr.length}</p>;
}`);
    expect(result.groups[0].inputs).toEqual(['props']);
  });

  it('keeps hook results and call results as inputs', () => {
    const result = read(`import { useState } from 'react';
function A({ pick }) {
  const [count] = useState(0);
  const v = pick(count);
  const arr = [count, v];
  return <p>{arr.length}</p>;
}`);
    expect(result.groups[0].inputs).toEqual(['count', 'v']);
  });

  it('adds the inputs of another group it reads', () => {
    const result = read(`function A({ a, b }) {
  const first = [a];
  const second = [first.length, b];
  return <p>{second.length}</p>;
}`);
    expect(result.groups.map((group) => group.members)).toEqual([['first'], ['second']]);
    expect(result.groups[1].inputs).toEqual(['a', 'b']);
  });

  it('skips module names, imports and closure parameters', () => {
    const result = read(`import { scale } from './scale';
const BASE = 2;
function A({ a }) {
  const f = (x) => x * scale * BASE * a;
  return <p>{f(1)}</p>;
}`);
    expect(result.groups[0].inputs).toEqual(['a']);
  });

  it('walks the scope chain when parameters have a default', () => {
    const result = read(`function A({ a } = {}) {
  const arr = [a];
  arr.push(1);
  return <p>{arr.length}</p>;
}`);
    expect(result.groups[0].members).toEqual(['arr']);
    expect(result.groups[0].inputs).toEqual(['a']);
  });
});

describe('opaque', () => {
  it('lists a non-fresh local that is mutated during render, and what it aliases', () => {
    const result = read(`function A({ pick }) {
  const v = pick();
  const w = v;
  w.push(1);
  return <p>{v.length}</p>;
}`);
    expect(result.opaque).toEqual(['v', 'w']);
    expect(result.groups).toEqual([]);
  });

  it('lists a local that a closure writes', () => {
    const result = read(`function A({ list }) {
  let total = 0;
  const add = (v) => { total += v; };
  list.forEach(add);
  return <p>{total}</p>;
}`);
    expect(result.opaque).toEqual(['total']);
  });
});

describe('escaping-closure', () => {
  it('bails when a closure escapes into JSX before its group stops changing', () => {
    const result = read(`function A({ a }) {
  const out = [];
  const add = () => { out.push(a); };
  const el = <button onClick={add} />;
  out.push(1);
  return <div>{el}{out.length}</div>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: 'add' });
  });

  it('bails when a closure is given to a hook before a later mutation', () => {
    const result = read(`import { useEffect } from 'react';
function A({ a }) {
  const out = [];
  useEffect(() => { out.push(a); });
  out.push(1);
  return <p>{out.length}</p>;
}`);
    expect(result.bailout?.reason).toBe('escaping-closure');
    expect(result.bailout?.text).toContain('useEffect');
  });

  it('bails when an unknown call receives the closure inside a loop', () => {
    const result = read(`function A({ list, register }) {
  const out = [];
  const add = (v) => { out.push(v); };
  for (const v of list) { register(add); }
  return <p>{out.length}</p>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: 'register(add)' });
  });

  it('allows a read-only closure that escapes after the last mutation', () => {
    const result = read(`function A({ a, show }) {
  const out = [];
  const log = () => { show(out.length); };
  out.push(a);
  return <div onClick={log}>{out.length}</div>;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('allows a closure passed to an unknown call that is the last mutation', () => {
    const result = read(`function A({ register }) {
  const out = [];
  register(() => out);
  return <p>{out.length}</p>;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('bails on an event handler that mutates a captured group', () => {
    const result = read(`function A({ a }) {
  const items = [a];
  return <button onClick={() => { items.push(1); }}>{items.length}</button>;
}`);
    expect(result.bailout).toEqual({
      reason: 'escaping-closure',
      text: '() => { items.push(1); }',
    });
  });

  it('bails on a named handler that mutates through a field', () => {
    const result = read(`function A({ a }) {
  const box = { n: a };
  const bump = () => { box.n += 1; };
  return <button onClick={bump}>{box.n}</button>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: 'bump' });
  });

  it('bails on an effect that mutates a captured group, even as the last mutation', () => {
    const result = read(`import { useEffect } from 'react';
function A({ a }) {
  const items = [a];
  useEffect(() => { items.push(1); });
  return <p>{items.length}</p>;
}`);
    expect(result.bailout?.reason).toBe('escaping-closure');
    expect(result.bailout?.text).toContain('useEffect');
  });

  it('bails on a handler that calls a mutating closure', () => {
    const result = read(`function A({ a }) {
  const items = [a];
  const add = () => { items.push(1); };
  return <button onClick={() => add()}>{items.length}</button>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: '() => add()' });
  });

  it('bails on a handler that mutates through a local alias', () => {
    const result = read(`function A({ a }) {
  const items = [a];
  const f = () => { const x = items; x.push(1); };
  return <b onClick={f}>{items.length}</b>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: 'f' });
  });

  it('bails on a handler that mutates through a forEach parameter', () => {
    const result = read(`function A({ a }) {
  const items = [{ n: a }];
  return <b onClick={() => items.forEach((i) => { i.n++; })}>{items.length}</b>;
}`);
    expect(result.bailout?.reason).toBe('escaping-closure');
  });

  it('bails on a handler that mutates through a for...of variable', () => {
    const result = read(`function A({ a }) {
  const items = [{ n: a }];
  return <b onClick={() => { for (const i of items) i.n = 1; }}>{items.length}</b>;
}`);
    expect(result.bailout?.reason).toBe('escaping-closure');
  });

  it('bails on a handler that mutates an element read during render', () => {
    const result = read(`function A({ a }) {
  const items = [{ n: a }];
  const first = items[0];
  return <b onClick={() => { first.n = 2; }}>{items.length}</b>;
}`);
    expect(result.bailout?.reason).toBe('escaping-closure');
  });

  it('allows a handler that changes an object it builds itself', () => {
    const result = read(`import { useCallback } from 'react';
function A({ v, send }) {
  const opts = { v };
  const onChange = useCallback((e) => {
    const next = { ...opts, x: e.target.value };
    next.y = 1;
    send(next);
  }, [opts]);
  return <input onChange={onChange} />;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('allows a handler that gives a captured value to an unknown call (known gap)', () => {
    const result = read(`function A({ a, mutate }) {
  const items = [a];
  return <b onClick={() => mutate(items)}>{items.length}</b>;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('allows a read-only handler that escapes before a read-only map callback', () => {
    const result = read(`function A({ v, setItems }) {
  const items = [v];
  const add = (x) => setItems([...items, x]);
  return (
    <b onClick={() => add(1)}>
      {items.map((i) => <i key={i} onClick={() => setItems(items.slice(1))}>{i}</i>)}
    </b>
  );
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('bails on a handler that gives the items to a module callback', () => {
    const result = read(`function bump(i) { i.n++; }
function A({ v }) {
  const items = [{ n: v }];
  return <b onClick={() => items.forEach(bump)}>{items.length}</b>;
}`);
    expect(result.bailout).toEqual({
      reason: 'escaping-closure',
      text: '() => items.forEach(bump)',
    });
  });

  it('bails on a handler that gives the items to a prop callback', () => {
    const result = read(`function A({ v, onItem }) {
  const items = [{ n: v }];
  const run = () => { items.filter(Boolean).forEach(onItem); };
  return <b onClick={run}>{items.length}</b>;
}`);
    expect(result.bailout).toEqual({ reason: 'escaping-closure', text: 'run' });
  });

  it('allows a handler that gives the items to a pure global callback', () => {
    const result = read(`function A({ v }) {
  const items = [v];
  return <b onClick={() => items.forEach(console.log)}>{items.length}</b>;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('allows a read-only handler', () => {
    const result = read(`function A({ a, setX }) {
  const items = [a];
  return <button onClick={() => setX(items.length)}>{items.join(',')}</button>;
}`);
    expect(result.bailout).toBeUndefined();
  });

  it('allows a fresh array that is not a closure to escape early', () => {
    const result = read(`function A({ a }) {
  const out = [];
  const el = <List items={out} />;
  out.push(a);
  return el;
}`);
    expect(result.bailout).toBeUndefined();
    expect(result.groups[0].members).toEqual(['out', 'el']);
  });
});

describe('api', () => {
  it('returns binding ids and no bailout key for an eligible unit', () => {
    const code = `function A({ a }) { const arr = [a]; return <p>{arr.length}</p>; }`;
    const scope = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    const report = analyzeOwnership(scope, 0);
    expect(report.groups[0].members).toEqual([1]);
    expect('bailout' in report).toBe(false);
  });

  it('fills bailout as an ok: false eligibility entry', () => {
    const code = `function A() { const items = []; return <i onClick={() => { items.push(1); }} />; }`;
    const scope = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    expect(analyzeOwnership(scope, 0).bailout).toMatchObject({
      unit: 0,
      ok: false,
      reason: 'escaping-closure',
    });
  });

  it('returns an empty result for a unit id that does not exist', () => {
    const scope = parseAndScope(`const x = 1;`, { filename: 'input.jsx', preset: 'react' });
    expect(analyzeOwnership(scope, 4)).toEqual({ unit: 4, groups: [], opaque: [] });
  });
});

// Hand-written expectations for every alias case of the tuning corpus.
describe('tuning alias cases', () => {
  it('alias_branch', () => {
    expect(readTuning('alias_branch')).toEqual({
      groups: [
        {
          members: ['out'],
          created: ['[a]'],
          mutations: [['out.push(b)', 'branch']],
          frozenAfter: ' out.push(b)',
          inputs: ['a', 'b', 'flag'],
        },
      ],
      opaque: [],
    });
  });

  it('alias_child', () => {
    // `pick(a, b)` receives no fresh value, so `v` is a frozen input and no group exists.
    expect(readTuning('alias_child')).toEqual({ groups: [], opaque: [] });
  });

  it('alias_closure', () => {
    expect(readTuning('alias_closure')).toEqual({
      groups: [
        {
          members: ['out', 'add'],
          created: ['[]', '(v) => { out.push(v * 2); }'],
          mutations: [['add(v)', 'block']],
          // The call repeats in the loop, so the group is frozen after the loop.
          frozenAfter: ' { add(v); }',
          inputs: ['list'],
        },
      ],
      opaque: [],
    });
  });

  it('alias_field', () => {
    expect(readTuning('alias_field')).toEqual({
      groups: [
        {
          members: ['items', 'box'],
          created: ['[a]', '{ items, tag }'],
          mutations: [['box.items.push(b)', 'unit']],
          frozenAfter: 'tems.push(b)',
          inputs: ['a', 'b', 'tag'],
        },
      ],
      opaque: [],
    });
  });

  it('alias_push', () => {
    expect(readTuning('alias_push')).toEqual({
      groups: [
        {
          members: ['arr', 'x'],
          created: ['[a]'],
          mutations: [['x.push(b)', 'unit']],
          frozenAfter: '\n  x.push(b)',
          inputs: ['a', 'b'],
        },
      ],
      opaque: [],
    });
  });

  it('alias_spread', () => {
    // The copy is a new group, so the `list` prop is only an input.
    expect(readTuning('alias_spread')).toEqual({
      groups: [
        {
          members: ['copy'],
          created: ['[...list]'],
          mutations: [['copy.push(extra)', 'unit']],
          frozenAfter: '.push(extra)',
          inputs: ['list', 'extra'],
        },
      ],
      opaque: [],
    });
  });

  it('alias_unknown', () => {
    expect(readTuning('alias_unknown')).toEqual({
      groups: [
        {
          members: ['arr', 'n'],
          created: ['[a]'],
          mutations: [['grow(arr, b)', 'unit']],
          frozenAfter: 'grow(arr, b)',
          inputs: ['a', 'b', 'grow'],
        },
      ],
      opaque: [],
    });
  });
});
