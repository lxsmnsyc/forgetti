import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(source: string): string {
  return compile(source, { preset: 'react', filename: 'input.jsx' }).code;
}

function countChecks(code: string): number {
  return code.match(/\bif \(/g)?.length ?? 0;
}

describe('slot groups', () => {
  it('gives elements with one input set a single block', () => {
    const code = run(
      'import { A, B } from "x";\nexport function S({ a }) { return <div><A x={a} /><B y={a} /></div>; }\n',
    );

    expect(code).toContain('useCache(useRef, 2)');
    expect(countChecks(code)).toBe(1);
  });

  it('shares one compare between sibling elements with the same inputs', () => {
    const code = run(
      'import { A, B, C } from "x";\nexport function S({ a, b }) { return <div><A x={a} /><B y={a} /><C z={b} /></div>; }\n',
    );

    // One block for A and B, one for C, one for the div over their outputs.
    expect(countChecks(code)).toBe(3);
    expect(code).toContain('useCache(useRef, 9)');
  });

  it('splits elements with different inputs, so an unknown call feeds only its own child', () => {
    const code = run(
      [
        'import { Child } from "x";',
        'export function O({ a, b, pick }) {',
        '  const v = pick(a, b);',
        '  return <div><Child v={v} /><Child v={b} /></div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('Object.is($[4], v)');
    expect(code).toContain('Object.is($[6], b)');
  });

  it('gives no slot to cheap expressions', () => {
    const code = run(
      [
        'export function Cheap({ a, name }) {',
        '  const next = a + 1;',
        '  const label = `${name}!`;',
        '  const first = name.first;',
        '  return next + label + first;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toContain('useCache(');
  });

  it('caches an object literal by its inputs', () => {
    const code = run(
      'import { Box } from "x";\nexport function Styled({ color }) { const style = { color }; return <Box style={style} />; }\n',
    );

    expect(code).toContain('Object.is($[0], color)');
  });

  it('keys a frozen group on its inputs and not on its members', () => {
    const code = run(
      [
        'export function Branch({ a, b, flag }) {',
        '  const out = [a];',
        '  if (flag) { out.push(b); }',
        '  return <p>{out.join(",")}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('Object.is($[0], a)');
    expect(code).toContain('Object.is($[1], b)');
    expect(code).toContain('Object.is($[2], flag)');
    expect(code).not.toMatch(/Object\.is\(\$\[\d\], out\)/);
  });

  it('does not key a group on inputs when it reads a global that changes', () => {
    const code = run(
      [
        'export function Now({ a }) {',
        '  const out = [a];',
        '  out.push(Date.now());',
        '  return <p>{out.join(",")}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countChecks(code)).toBe(0);
  });

  it('does not cache a group read before its last mutation', () => {
    const code = run(
      [
        'export function Late({ a, b }) {',
        '  const out = [a];',
        '  const view = <p>{out.length}</p>;',
        '  out.push(b);',
        '  return view;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toMatch(/Object\.is\(\$\[\d\], out\)/);
    expect(code).not.toContain('Object.is($[0], a)');
  });

  it('never gives a hook call or use() a slot', () => {
    const code = run(
      [
        'import { use, useMemo } from "react";',
        'export function Hooks({ a, p }) {',
        '  const data = use(p);',
        '  const m = useMemo(() => a, [a]);',
        '  return <p>{data}{m}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('const data = use(p);');
    expect(code).toContain('const m = useMemo(');
    expect(code).toContain('Object.is($[0], data)');
    expect(code).toContain('Object.is($[1], m)');
  });

  it('does not cache a local that a switch rebinds', () => {
    const code = run(
      [
        'export function Pick({ k, a }) {',
        '  let el = null;',
        '  switch (k) { case 1: el = <b>{a}</b>; break; default: el = <i>{a}</i>; }',
        '  return <div>{el}</div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toMatch(/Object\.is\(\$\[\d\], el\)/);
  });
});
