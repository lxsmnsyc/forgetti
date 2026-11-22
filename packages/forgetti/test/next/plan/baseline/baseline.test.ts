import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

function run(source: string): ReturnType<typeof compile> {
  return compile(source, { preset: 'react', filename: 'input.jsx' });
}

function countCaches(code: string): number {
  return code.match(/useCache\(useRef, \d+\)/g)?.length ?? 0;
}

describe('baseline planner', () => {
  it('caches a returned element by its props', () => {
    const { code, units } = run('export function Card({ title }) { return <h1>{title}</h1>; }\n');

    expect(code).toContain('useCache(useRef, 2)');
    expect(code).toContain('Object.is($[0], title)');
    expect(units).toEqual([{ name: 'Card', compiled: true }]);
  });

  it('caches a const call result and uses it as an input of the element', () => {
    const { code } = run(
      [
        'function costly(v) { return v * 2; }',
        'export function Derived({ a }) {',
        '  const x = costly(a);',
        '  return <p>{x}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('useCache(useRef, 4)');
    expect(code).toContain('Object.is($[0], a)');
    expect(code).toContain('Object.is($[2], x)');
  });

  it('does not cache a value read from a mutated local', () => {
    const { code, units } = run(
      [
        'export function Pushed({ a, b }) {',
        '  const arr = [a];',
        '  arr.push(b);',
        '  return <p>{arr.join(",")}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(0);
    expect(units).toEqual([{ name: 'Pushed', compiled: true }]);
  });

  it('does not cache a reassigned local', () => {
    const { code } = run(
      [
        'export function Counter({ a }) {',
        '  let n = a;',
        '  n = n + 1;',
        '  return <p>{n}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(0);
  });

  it('does not cache a call result that is passed to another call', () => {
    const { code } = run(
      [
        'function make(v) { return [v]; }',
        'function consume(list) { list.push(1); }',
        'export function Leaky({ a }) {',
        '  const list = make(a);',
        '  consume(list);',
        '  return <p>{list.length}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toContain('Object.is($[0], a)');
  });

  it('does not cache reads of a ref or a changing global', () => {
    const { code } = run(
      [
        "import { useRef } from 'react';",
        'export function Reads() {',
        '  const ref = useRef(0);',
        '  return <p>{ref.current}</p>;',
        '}',
        'export function Time() {',
        '  return <p>{Date.now()}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(0);
  });

  it('leaves a bailed out unit as written and reports it', () => {
    const source = 'export function Bad(props) { props.x = 1; return <p>{props.x}</p>; }\n';
    const { code, diagnostics, units } = run(source);

    expect(code).toBe(source);
    expect(diagnostics.map((item) => item.reason)).toEqual(['mutates-props']);
    expect(units).toEqual([{ name: 'Bad', compiled: false }]);
  });

  it('leaves a skipped unit as written without a diagnostic', () => {
    const source = '/* @forgetti skip */\nexport function Skipped({ a }) { return <p>{a}</p>; }\n';
    const { code, diagnostics, units } = run(source);

    expect(code).toBe(source);
    expect(diagnostics).toEqual([]);
    expect(units).toEqual([{ name: 'Skipped', compiled: false }]);
  });

  it('does not cache a computed access to a changing global', () => {
    const { code } = run('export function Rand({ n }) { return <p>{Math["random"]() * n}</p>; }\n');

    expect(countCaches(code)).toBe(0);
  });

  it('does not cache a hook called through a string key', () => {
    const { code } = run(
      [
        "import * as React from 'react';",
        'export function Keyed({ a }) {',
        '  const v = React["useMemo"](() => a, [a]);',
        '  return <p>{v}</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toContain('if (!Object.is($[0], a))');
  });

  it('does not cache a call with no fixed callee name', () => {
    const { code } = run(
      'function f(v) { return v; }\nexport function Seq({ a }) { return <p>{(0, f)(a)}</p>; }\n',
    );

    expect(countCaches(code)).toBe(0);
  });

  it('does not cache a call to a module function that reads a reassigned binding', () => {
    const { code } = run(
      [
        'let theme = "a";',
        'export function setTheme(t) { theme = t; }',
        'const get = () => theme;',
        'export function Themed({ n }) { return <p>{get()}{n}</p>; }',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(0);
  });

  it('caches a call to a module function that reads only fixed bindings', () => {
    const { code } = run(
      [
        'const base = 2;',
        'function twice(v) { return v * base; }',
        'export function Fixed({ n }) { return <p>{twice(n)}</p>; }',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(1);
  });

  it('assumes an imported function is pure', () => {
    const { code } = run(
      [
        "import { t } from './i18n';",
        'export function Greeting({ n }) { return <p>{t("hi")}{n}</p>; }',
        'export function Static() { return <p>{t("hi")}</p>; }',
        '',
      ].join('\n'),
    );

    expect(countCaches(code)).toBe(2);
    expect(code).toContain('=== EMPTY');
  });

  it('does not cache a call to a module function that reads a changing global', () => {
    const sources = [
      'function now() { return Date.now(); }\nexport function A({ n }) { return <p>{now()}{n}</p>; }\n',
      'const get = () => window.innerWidth;\nexport function B({ n }) { return <p>{get()}{n}</p>; }\n',
      'function roll() { return Math.random(); }\nexport function C({ n }) { return <p>{roll()}{n}</p>; }\n',
    ];

    for (const source of sources) {
      expect(countCaches(run(source).code)).toBe(0);
    }
  });

  it('caches a call to a module function that reads only stable globals', () => {
    const { code } = run(
      'function top(a, b) { return Math.max(a, b); }\nexport function D({ n }) { return <p>{top(n, 1)}</p>; }\n',
    );

    expect(countCaches(code)).toBe(1);
  });
});
