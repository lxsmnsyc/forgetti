import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/next';
import { analyzeOwnership } from '../../../src/next/ownership';
import { parseAndScope } from '../../../src/next/parse';

function bailoutOf(code: string): string | undefined {
  const scope = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
  const { bailout } = analyzeOwnership(scope, scope.units[0].id);
  return bailout ? code.slice(bailout.range.start, bailout.range.end) : undefined;
}

describe('closures that are called during render', () => {
  it('compiles a helper that only reads what it captures, called twice', () => {
    expect(
      bailoutOf(`function A({ a, b }) {
  const tag = (x) => <i>{x}</i>;
  const row = (x, y) => <b>{tag(x)}{a}{y}</b>;
  return <div>{row(1, b)}{row(2, b)}</div>;
}`),
    ).toBeUndefined();
  });

  // Render: `log` holds [1, 2] after both calls and the cell reads 2. A cached first call would
  // keep length 1. Probe `HelperMutates` in `probes/` runs it through the harness.
  it('bails when the helper pushes to a captured array and a later call reads it', () => {
    expect(
      bailoutOf(`function A({ a }) {
  const log = [];
  const row = (x) => <b>{log.push(x)}{a}</b>;
  return <div>{row(1)}{row(2)}{log.length}</div>;
}`),
    ).toBe('row(1)');
  });

  // `row` pushes to `list`, so after two calls `list.length` is 3. A cached `row(list)` would
  // show 2 in the last cell. Probe `HelperArg`.
  it('bails when the helper changes its argument', () => {
    expect(
      bailoutOf(`function A({ a }) {
  const list = [a];
  const row = (l) => { l.push(1); return <b>{a}</b>; };
  return <div>{row(list)}{row(list)}{list.length}</div>;
}`),
    ).toBe('row(list)');
  });

  // `keep` holds `list` twice after both calls, so `keep.length` is 2. A cached first call keeps
  // 1. Probe `HelperArg` covers the same path.
  it('bails when the helper stores its argument in a captured array', () => {
    expect(
      bailoutOf(`function A({ a }) {
  const list = [a];
  const keep = [];
  const row = (l) => { keep.push(l); return <b>{a}</b>; };
  return <div>{row(list)}{row(list)}{keep.length}</div>;
}`),
    ).toBe('row(list)');
  });

  // `add` pushes through `row`, so `log.length` is 2 after both calls. Probe `PassNested` has the
  // same shape through a pass-by-argument.
  it('bails when the helper calls another helper that changes a captured array', () => {
    expect(
      bailoutOf(`function A({ a }) {
  const log = [];
  const add = (x) => { log.push(x); };
  const row = (x) => { add(x); return <b>{a}</b>; };
  return <div>{row(1)}{row(2)}{log.length}</div>;
}`),
    ).toBe('row(1)');
  });
});

// Each shape below changes a captured value through a call inside a helper that runs twice in
// render. Caching the first call would show the old value in `<i>{...}</i>`. The harness runs
// each one on both targets with 0 differences, as `Pass*` probes in
// `docs/roadmaps/compiler-rewrite/nodes/fix-escaping-closure/probes/`. Here each must stay
// uncompiled, so the output is the source.
describe('a helper that passes a captured value to a call that changes it', () => {
  const SINK = 'function sink(o) { o.n += 1; }\n';
  const SHAPES: Record<string, string> = {
    // Renders 2, then reads 2 in the last cell. A cached `row()` reads 1.
    'module function': `${SINK}function A({ a }) {
  const box = { n: a };
  const row = () => { sink(box); return <b>{box.n}</b>; };
  return <div>{row()}{row()}<i>{box.n}</i></div>;
}`,
    'local closure': `function A({ a }) {
  const list = [];
  const add = (l) => { l.push(a); };
  const row = () => { add(list); return <b>{list.length}</b>; };
  return <div>{row()}{row()}<i>{list.length}</i></div>;
}`,
    'method of an object': `const util = { inc(o) { o.n += 1; } };
function A({ a }) {
  const box = { n: a };
  const row = () => { util.inc(box); return <b>{box.n}</b>; };
  return <div>{row()}{row()}<i>{box.n}</i></div>;
}`,
    'two helpers deep': `function A({ a }) {
  const list = [];
  const add = (l) => { l.push(a); };
  const inner = () => { add(list); };
  const row = () => { inner(); return <b>{list.length}</b>; };
  return <div>{row()}{row()}<i>{list.length}</i></div>;
}`,
    'spread argument': `${SINK}function A({ a }) {
  const box = { n: a };
  const row = () => { sink(...[box]); return <b>{box.n}</b>; };
  return <div>{row()}{row()}<i>{box.n}</i></div>;
}`,
    alias: `${SINK}function A({ a }) {
  const box = { n: a };
  const row = () => { const b2 = box; sink(b2); return <b>{box.n}</b>; };
  return <div>{row()}{row()}<i>{box.n}</i></div>;
}`,
  };

  for (const [name, code] of Object.entries(SHAPES)) {
    it(`bails on ${name}`, () => {
      const result = compile(code, { preset: 'react', filename: 'input.jsx' });
      expect(result.diagnostics.map((item) => item.reason)).toEqual(['escaping-closure']);
      expect(result.code).not.toContain('useCache');
    });
  }

  it('compiles a helper that gives the captured value to a pure global only', () => {
    expect(
      bailoutOf(`function A({ a, b }) {
  const box = { n: a };
  const row = (x) => <b>{Math.max(box.n, x)}</b>;
  return <div>{row(b)}{row(b)}</div>;
}`),
    ).toBeUndefined();
  });
});

describe('a module let that render assigns', () => {
  // The closure reads `tick`, which changes on every render. A block that calls it must run again.
  it('does not keep a helper that reads it, so the block that calls it runs again', () => {
    const { code } = compile(
      `let tick = 0;
export function A({ a }) {
  tick += 1;
  const row = (x) => <b>{x + tick}</b>;
  return <div>{row(a)}{row(a)}</div>;
}`,
      { preset: 'react', filename: 'input.jsx' },
    );
    expect(code).not.toContain('EMPTY');
    // The helper is new on every render, so a block keyed on it never hits.
    expect(code).toContain('const row = (x) =>');
  });
});

describe('Object.keys on a call result', () => {
  function countCaches(code: string): number {
    return code.match(/useCache\(useRef, \d+\)/g)?.length ?? 0;
  }

  it('caches a call result that is only passed to Object.keys and read', () => {
    const { code } = compile(
      `function check(v) { return { v }; }
export function A({ a }) {
  const errors = check(a);
  const n = Object.keys(errors).length;
  return <p>{n}{errors.v}</p>;
}`,
      { preset: 'react', filename: 'input.jsx' },
    );
    expect(code).toMatch(/Object\.is\(\$\[\d\], a\)/);
    expect(countCaches(code)).toBe(1);
  });

  // `Object.assign` changes its first argument, so the call result is not shared.
  it('does not cache a call result that Object.assign changes', () => {
    const { code } = compile(
      `function check(v) { return { v }; }
export function A({ a, b }) {
  const errors = check(a);
  Object.assign(errors, b);
  return <p>{errors.v}</p>;
}`,
      { preset: 'react', filename: 'input.jsx' },
    );
    expect(code).not.toMatch(/Object\.is\(\$\[\d\], errors\)/);
    expect(code).not.toMatch(/\$\[\d\] = check\(a\)/);
  });
});
