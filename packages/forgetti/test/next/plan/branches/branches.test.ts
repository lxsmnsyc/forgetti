import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(source: string): string {
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

function countBranches(code: string): number {
  return code.match(/= branch\(/g)?.length ?? 0;
}

describe('branch caches', () => {
  it('gives each arm of a returned ternary its own cache and no outer block', () => {
    const code = run(
      'import { A, B } from "x";\nexport function T({ ok, a, b }) { return ok ? <A v={a} /> : <B v={b} />; }\n',
    );

    expect(countBranches(code)).toBe(2);
    expect(code).toContain('useCache(useRef, 2)');
    expect(code).not.toContain('Object.is($[0], ok)');
    expect(code).toContain('Object.is($1[0], a)');
    expect(code).toContain('Object.is($2[0], b)');
  });

  it('gives each case of a switch a cache, including a static default', () => {
    const code = run(
      [
        'import { A } from "x";',
        'export function S({ kind, a }) {',
        '  let el;',
        '  switch (kind) {',
        '    case "a": el = <A v={a} />; break;',
        '    default: el = <em>none</em>;',
        '  }',
        '  return <div>{el}</div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(2);
    expect(code).toContain('EMPTY');
  });

  it('caches the arms of an if and of an else if chain', () => {
    const code = run(
      [
        'import { A, B, C } from "x";',
        'export function I({ k, a, b, c }) {',
        '  if (k === 1) {',
        '    return <A v={a} />;',
        '  } else if (k === 2) {',
        '    return <B v={b} />;',
        '  }',
        '  return <C v={c} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(2);
  });

  it('keeps the cache hook above an early return', () => {
    const code = run(
      [
        'import { A } from "x";',
        'export function E({ loading, a }) {',
        '  if (loading) return <p>loading</p>;',
        '  return <A v={a} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code.indexOf('useCache(')).toBeLessThan(code.indexOf('if (loading)'));
    expect(code.indexOf('useCache(')).toBeLessThan(code.indexOf('branch('));
  });

  it('gives the right side of && its own cache', () => {
    const code = run(
      [
        'import { A } from "x";',
        'export function L({ show, a }) {',
        '  const el = show && <A v={a} />;',
        '  return <div>{el}</div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(1);
  });

  it('gives a ternary inside JSX arm caches', () => {
    const code = run(
      'import { A, B } from "x";\nexport function N({ ok, a, b }) { return <div>{ok ? <A v={a} /> : <B v={b} />}</div>; }\n',
    );

    expect(countBranches(code)).toBe(2);
  });

  it('handles a ternary chain with one cache per leaf', () => {
    const code = run(
      'import { A, B, C } from "x";\nexport function C3({ k, a, b, c }) { return k === 1 ? <A v={a} /> : k === 2 ? <B v={b} /> : <C v={c} />; }\n',
    );

    expect(countBranches(code)).toBe(3);
  });

  it('plans an arrow component with a ternary body', () => {
    const code = run(
      'import { A, B } from "x";\nexport const T = ({ ok, a, b }) => ok ? <A v={a} /> : <B v={b} />;\n',
    );

    expect(countBranches(code)).toBe(2);
  });
});

describe('refusals inside branch caches', () => {
  it('does not cache an arm that calls use()', () => {
    const code = run(
      [
        'import { use } from "react";',
        'import { Ctx, A } from "x";',
        'export function U({ flag, name }) {',
        '  const v = flag ? use(Ctx) : "none";',
        '  return <A v={v} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(0);
  });

  it('keeps use() out of the cache when only the other arm is cached', () => {
    const code = run(
      [
        'import { use } from "react";',
        'import { Ctx, A } from "x";',
        'export function U({ flag, a }) {',
        '  return flag ? <A v={a} /> : use(Ctx);',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(1);
    expect(code).toMatch(/use\(Ctx\)/);
    expect(code).not.toMatch(/\$\d\[\d\] = use\(Ctx\)/);
  });

  it('does not cache an arm that reads a ref', () => {
    const code = run(
      [
        'import { useRef } from "react";',
        'import { A } from "x";',
        'export function R({ ok, a }) {',
        '  const r = useRef(0);',
        '  return ok ? <A v={r.current} /> : <A v={a} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toMatch(/\$\d\[\d\] = <A v=\{r\.current\}/);
  });

  it('does not cache an arm with an impure member or a changing global', () => {
    const code = run(
      [
        'import { A } from "x";',
        'export function G({ ok, a }) {',
        '  return ok ? <A v={Date.now()} w={a} /> : <A v={Math.random()} w={a} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(0);
  });

  it('does not cache an arm that calls a callee with no fixed name', () => {
    const code = run(
      [
        'import { A, fns } from "x";',
        'export function K({ ok, a, i }) {',
        '  return ok ? <A v={fns[i](a)} /> : <A v={a} />;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toMatch(/= <A v=\{fns\[i\]\(a\)\}/);
  });

  it('does not cache an arm that calls a module helper reading a reassigned binding', () => {
    const code = run(
      [
        'import { A } from "x";',
        'let n = 0;',
        'export function bump() { n += 1; }',
        'function read(v) { return v + n; }',
        'export function H({ ok, a }) {',
        '  return ok ? <A v={read(a)} /> : null;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(0);
  });

  it('does not move a conditional after an impure call in the same element', () => {
    const code = run(
      [
        'import { A, side } from "x";',
        'export function M({ a }) {',
        '  return <div>{side()}{Date.now() > a ? <A v={a} /> : null}</div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countBranches(code)).toBe(0);
  });
});
