import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as babel from '@babel/core';
import { describe, it } from 'vitest';
import type { ParseResult } from '../../../src/next/parse';
import { parseAndScope } from '../../../src/next/parse';
import { source as derivedSource } from '../fixtures/derived.plan';
import { source as mapSource } from '../fixtures/map.plan';
import { source as ternarySource } from '../fixtures/ternary.plan';

const CORPUS = join(import.meta.dirname, '../../../../../benchmarks/corpus/base');

function analyze(code: string, filename = 'input.jsx'): ParseResult {
  return parseAndScope(code, { filename, preset: 'react' });
}

/** Every reference as `name -> declaration start`, or `name -> global`, keyed by its start. */
function listResolutions(result: ParseResult): Map<number, string> {
  const map = new Map<number, string>();
  for (const binding of result.bindings) {
    for (const reference of binding.references) {
      map.set(reference.range.start, `${binding.name} -> ${binding.declaration.start}`);
    }
  }
  for (const reference of result.globals) {
    map.set(reference.range.start, `${reference.node.name} -> global`);
  }
  return map;
}

/** Babel's view of the same module: each read reference and the identifier that declares it. */
function listBabelReads(code: string): Map<number, string> {
  const ast = babel.parseSync(code, {
    parserOpts: { plugins: ['jsx'] },
    babelrc: false,
    configFile: false,
  });
  const map = new Map<number, string>();
  if (!ast) {
    return map;
  }
  babel.traverse(ast, {
    ReferencedIdentifier(path) {
      const node = path.node;
      // A closing tag repeats its opening tag. `x++` and `x += 1` are writes here.
      if (path.findParent((parent) => parent.isJSXClosingElement())) {
        return;
      }
      if (
        path.parentPath.isUpdateExpression() ||
        (path.parentPath.isAssignmentExpression() && path.key === 'left')
      ) {
        return;
      }
      const name = node.type === 'JSXIdentifier' ? node.name : node.name;
      const binding = path.scope.getBinding(name);
      const target = binding ? String(binding.identifier.start) : 'global';
      map.set(node.start ?? -1, `${name} -> ${target}`);
    },
  });
  return map;
}

/** Keeps only the read references, since babel's list holds no writes. */
function listReads(result: ParseResult): Map<number, string> {
  const all = listResolutions(result);
  const writes = new Set<number>();
  for (const binding of result.bindings) {
    for (const reference of binding.references) {
      if (reference.write) {
        writes.add(reference.range.start);
      }
    }
  }
  for (const reference of result.globals) {
    if (reference.write) {
      writes.add(reference.range.start);
    }
  }
  for (const start of writes) {
    all.delete(start);
  }
  return all;
}

const STRESS = `
import def, { a as b, c } from 'm';
import * as ns from 'n';
var hoisted = later();
function later() { return hoisted; }
export function Stress({ x, y: [z = c] = [], ...rest }, extra = x) {
  let total = 0;
  const { p, q: { r } } = rest;
  for (let i = 0; i < z; i++) { total += i; }
  for (const k in rest) { total += rest[k]; }
  for (const v of [p, r]) { const i = v; total += i; }
  label: while (total > 0) { total--; if (total === 3) break label; }
  try { throw new Error(); } catch ({ message }) { total += message.length; } finally { total++; }
  switch (x) { case 1: let s = 1; break; case 2: s = 2; break; default: s; }
  const fn = function self(n) { return n ? self(n - 1) : b; };
  const K = class Named { static m() { return Named; } };
  const obj = { x, [y]: def, nested: { z }, method() { return this; } };
  const arrow = (x) => x + total;
  ns.member.deep;
  obj.x.y = arguments;
  ({ x: total } = obj);
  [total] = [1];
  return <K.Inner prop={fn} {...obj}><div>{arrow(1)}</div><Stress /></K.Inner>;
}
`;

describe('references match babel', () => {
  const entries = readdirSync(CORPUS, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  for (const entry of entries) {
    it(entry.name, ({ expect }) => {
      const code = readFileSync(join(CORPUS, entry.name, 'input.jsx'), 'utf8');
      expect(listReads(analyze(code))).toEqual(listBabelReads(code));
    });
  }

  it('stress module', ({ expect }) => {
    // Babel binds `s` in the first case to the whole switch, as this phase does.
    expect(listReads(analyze(STRESS))).toEqual(listBabelReads(STRESS));
  });
});

/** Finds the reference at the `occurrence`-th match of `needle` and describes what it resolves to. */
function describeAt(result: ParseResult, code: string, needle: string, occurrence = 0): string {
  let start = -1;
  for (let count = 0; count <= occurrence; count++) {
    start = code.indexOf(needle, start + 1);
  }
  for (const binding of result.bindings) {
    for (const reference of binding.references) {
      if (reference.range.start === start) {
        const scope = result.scopes[binding.scope];
        return `${binding.kind} in ${scope.kind}${reference.write ? ' (write)' : ''}`;
      }
    }
  }
  for (const reference of result.globals) {
    if (reference.range.start === start) {
      return `global${reference.write ? ' (write)' : ''}`;
    }
  }
  return 'none';
}

describe('bindings', () => {
  it('resolves shadowed names to the innermost binding', ({ expect }) => {
    const code = `function Foo(a) { { const a = 1; a1(a); } if (a) { let a = 2; a2(a); } return a; }`;
    const result = analyze(code);
    expect(describeAt(result, code, 'a);', 0)).toBe('const in block');
    expect(describeAt(result, code, 'a) {', 1)).toBe('param in unit');
    expect(describeAt(result, code, 'a);', 1)).toBe('let in branch');
    expect(describeAt(result, code, 'a; }', 0)).toBe('param in unit');
  });

  it('marks references inside nested functions with the outermost closure', ({ expect }) => {
    const code = `function Foo(a) { const f = () => () => a; const g = function () { return a; }; return a; }`;
    const result = analyze(code);
    const [a] = result.bindings;
    expect(a.name).toBe('a');
    const outer = result.scopes.find((scope) => scope.range.start === code.indexOf('() => () =>'));
    const plain = result.scopes.find((scope) => scope.range.start === code.indexOf('function ()'));
    expect(a.references.map((reference) => reference.closure)).toEqual([
      outer?.id,
      plain?.id,
      undefined,
    ]);
    expect(outer?.kind).toBe('function');
  });

  it('declares every name in a destructuring pattern', ({ expect }) => {
    const code = `function Foo({ a, b: { c }, d = a, ...e }, [f, , g = f, ...h]) { return [a, c, d, e, f, g, h]; }`;
    const result = analyze(code);
    const params = result.bindings.filter((binding) => binding.kind === 'param');
    expect(params.map((binding) => binding.name)).toEqual(['a', 'c', 'd', 'e', 'f', 'g', 'h']);
    for (const binding of params) {
      expect(binding.references.length).toBeGreaterThanOrEqual(1);
    }
    expect(result.globals).toEqual([]);
  });

  it('marks destructuring, compound and update assignments as writes', ({ expect }) => {
    const code = `function Foo() { let a, b, c; [a, { b }] = [1, {}]; c += 1; c++; for (a of []) {} return a; }`;
    const result = analyze(code);
    const writes = result.bindings.map((binding) => [
      binding.name,
      binding.references.map((reference) => reference.write),
    ]);
    expect(writes).toEqual([
      ['a', [true, true, false]],
      ['b', [true]],
      ['c', [true, true]],
      ['Foo', []],
    ]);
  });

  it('scopes a catch parameter to its clause', ({ expect }) => {
    const code = `function Foo(e) { try { e; } catch (e) { e; } catch2: { e; } }`;
    const result = analyze(code);
    expect(describeAt(result, code, 'e; }', 0)).toBe('param in unit');
    expect(describeAt(result, code, 'e; }', 1)).toBe('catch in catch');
    expect(describeAt(result, code, 'e; }', 2)).toBe('param in unit');
  });

  it('ignores identifiers in TS type positions', ({ expect }) => {
    const code = `
import type { Props } from './types';
import { type Ref, value } from './values';
interface Local { a: Props }
type Alias = Local | Ref;
export function Foo(this: void, props: Props, ref: Ref<Alias>): Alias {
  const x = value as unknown as Alias;
  const y = <T,>(t: T): T => t;
  return (props satisfies Props)!, x, y<Props>(props);
}
`;
    const result = analyze(code, 'input.tsx');
    const names = result.bindings.map((binding) => binding.name);
    expect(names).not.toContain('Props');
    expect(names).not.toContain('Ref');
    expect(names).not.toContain('this');
    expect(result.globals).toEqual([]);
    const props = result.bindings.find((binding) => binding.name === 'props');
    expect(props?.references).toHaveLength(2);
  });

  it('hoists var and function declarations', ({ expect }) => {
    const code = `function Foo() { f(); g; if (1) { var g = 1; } function f() {} return g; }`;
    const result = analyze(code);
    const g = result.bindings.find((binding) => binding.name === 'g');
    expect(g?.kind).toBe('var');
    expect(result.scopes[g?.scope ?? -1].kind).toBe('unit');
    expect(g?.references).toHaveLength(2);
    expect(result.globals).toEqual([]);
  });

  it('records import sources and names', ({ expect }) => {
    const code = `import a, { b as c, 'd e' as d } from 'm'; import * as ns from 'n';`;
    const result = analyze(code);
    expect(result.bindings.map((binding) => [binding.name, binding.imported])).toEqual([
      ['a', { source: 'm', name: 'default' }],
      ['c', { source: 'm', name: 'b' }],
      ['d', { source: 'm', name: 'd e' }],
      ['ns', { source: 'n', name: '*' }],
    ]);
  });

  it('treats intrinsic JSX tags as non-references', ({ expect }) => {
    const code = `function Foo({ A }) { return <div><A /><my-el /><A.B /></div>; }`;
    const result = analyze(code);
    expect(result.bindings[0].references).toHaveLength(2);
    expect(result.globals).toEqual([]);
  });

  it('reports undeclared names as globals', ({ expect }) => {
    const code = `function Foo() { globalThis.x = window; y = 1; }`;
    const result = analyze(code);
    expect(result.globals.map((reference) => [reference.node.name, reference.write])).toEqual([
      ['globalThis', false],
      ['window', false],
      ['y', true],
    ]);
  });
});

describe('parameter defaults', () => {
  /** Describes the binding that the last match of `needle` resolves to. */
  function describeLast(code: string, needle: string): string {
    const result = analyze(code);
    return describeAt(result, code, needle, code.split(needle).length - 2);
  }

  it('do not see a body var', ({ expect }) => {
    const code = `const x = 1; function C(a = x) { var x = 2; return a; }`;
    expect(describeLast(code, 'x) {')).toBe('const in module');
  });

  it('do not see a body function', ({ expect }) => {
    const code = `function h() {} function C(a = h()) { function h() {} return a; }`;
    expect(describeLast(code, 'h()) {')).toBe('function in module');
  });

  it('do not see a body let from a closure', ({ expect }) => {
    const code = `const y = 1; function C(a = () => y) { let y; return a; }`;
    expect(describeLast(code, 'y) {')).toBe('const in module');
  });

  it('see earlier parameters', ({ expect }) => {
    const code = `function C(a, { b = a } = {}) { var a2 = a; return b; }`;
    const result = analyze(code);
    expect(describeAt(result, code, 'a }')).toBe('param in unit');
    expect(describeAt(result, code, 'a;')).toBe('param in unit');
  });

  it('put the body var in a block scope that keeps it', ({ expect }) => {
    const code = `function C(a = 1) { if (a) { var v = a; } return v; }`;
    const result = analyze(code);
    const v = result.bindings.find((binding) => binding.name === 'v');
    expect(result.scopes[v?.scope ?? -1].kind).toBe('block');
    expect(v?.references).toHaveLength(1);
    expect(result.bindings.slice(0, 2).map((binding) => binding.name)).toEqual(['a', 'v']);
  });
});

describe('own scopes', () => {
  it('keep a function expression name apart from its parameters and body', ({ expect }) => {
    const code = `const f = function F(F) { return F; }; const g = function G() { var G = 1; return G; };`;
    const result = analyze(code);
    const named = result.bindings.filter((binding) => binding.name === 'F' || binding.name === 'G');
    // `F` and `G` are units, so their own bindings come first and the names come last.
    expect(named.map((binding) => [binding.name, binding.kind, binding.references.length])).toEqual(
      [
        ['F', 'param', 1],
        ['G', 'var', 1],
        ['F', 'function', 0],
        ['G', 'function', 0],
      ],
    );
  });

  it('keep var inside a static block', ({ expect }) => {
    const code = `function C() { class K { static { var s = 1; } } return s; }`;
    const result = analyze(code);
    const s = result.bindings.find((binding) => binding.name === 's');
    expect(result.scopes[s?.scope ?? -1].kind).toBe('block');
    expect(result.globals.map((reference) => reference.node.name)).toEqual(['s']);
  });

  it('skip this in a JSX member tag', ({ expect }) => {
    const result = analyze(`class K { render() { return <this.Foo />; } }`);
    expect(result.globals).toEqual([]);
  });
});

describe('scopes', () => {
  it('opens branch, loop and catch scopes', ({ expect }) => {
    const code = `function Foo(a) {
  if (a) { a; } else a;
  const t = a ? a : a;
  a && a;
  a ??= a;
  switch (a) { case 1: a; }
  for (;;) { a; }
  while (a) a;
  try {} catch { a; }
  return () => a;
}`;
    const result = analyze(code);
    const kinds = result.bindings[0].references.map(
      (reference) => result.scopes[reference.scope].kind,
    );
    expect(kinds).toEqual([
      'unit',
      'branch',
      'branch',
      'unit',
      'branch',
      'branch',
      'unit',
      'branch',
      'unit',
      'branch',
      'unit',
      'branch',
      'block',
      'loop',
      'loop',
      'catch',
      'function',
    ]);
  });

  it('nests each scope inside its parent', ({ expect }) => {
    const result = analyze(STRESS);
    expect(result.scopes[0]).toMatchObject({ id: 0, parent: null, kind: 'module' });
    for (const scope of result.scopes) {
      if (scope.parent === null) {
        continue;
      }
      const parent = result.scopes[scope.parent];
      expect(parent.range.start).toBeLessThanOrEqual(scope.range.start);
      expect(parent.range.end).toBeGreaterThanOrEqual(scope.range.end);
    }
  });

  it('gives each unit a unit scope', ({ expect }) => {
    const code = `function helper() {} function Foo() { function Bar() {} }`;
    const result = analyze(code);
    const units = result.scopes.filter((scope) => scope.kind === 'unit');
    expect(units.map((scope) => scope.range.start)).toEqual([
      code.indexOf('function Foo'),
      code.indexOf('function Bar'),
    ]);
  });
});

describe('binding ids', () => {
  it('index the bindings array', ({ expect }) => {
    const result = analyze(STRESS);
    for (const [index, binding] of result.bindings.entries()) {
      expect(binding.id).toBe(index);
    }
  });

  it('follow the fixture order', ({ expect }) => {
    const names = (code: string, count: number): string[] =>
      analyze(code)
        .bindings.slice(0, count)
        .map((binding) => binding.name);
    expect(names(derivedSource, 5)).toEqual(['a', 'b', 'x', 'y', 'z']);
    expect(names(mapSource, 3)).toEqual(['items', 'title', 'item']);
    expect(names(ternarySource, 3)).toEqual(['ok', 'a', 'b']);
  });

  it('look up by reference and declaration node', ({ expect }) => {
    const result = analyze(derivedSource);
    for (const binding of result.bindings) {
      for (const reference of binding.references) {
        expect(result.bindingOf(reference.node)).toBe(binding);
      }
    }
  });
});
