import { describe, expect, it } from 'vitest';
import { compile } from '../../../../src/next';

/** The compiled code from the first exported component on. */
function run(source: string): string {
  const { code } = compile(source, { preset: 'react', filename: 'input.jsx' });
  return code.slice(code.indexOf('export function'));
}

describe('stable children', () => {
  it('caches an element whose tag is a memo wrapper from an import', () => {
    const code = run(
      [
        "import { memo } from 'react';",
        'const Tile = memo(function Tile({ id }) { return <i>{id}</i>; });',
        'export function List({ id }) {',
        '  return <div><Tile id={id} /></div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('Object.is($[0], id)');
  });

  it('does not cache an element whose wrapper can render on equal props', () => {
    const comparator = run(
      [
        "import { memo } from 'react';",
        'const Tile = memo(function Tile({ id }) { return <i>{id}</i>; }, () => false);',
        'export function List({ id }) {',
        '  return <div><Tile id={id} /></div>;',
        '}',
        '',
      ].join('\n'),
    );
    const forwarded = run(
      [
        "import { forwardRef } from 'react';",
        'const Tile = forwardRef(function Tile({ id }, ref) { return <i ref={ref}>{id + globalThis.g}</i>; });',
        'export function List({ id }) {',
        '  return <div><Tile id={id} /></div>;',
        '}',
        '',
      ].join('\n'),
    );
    const local = run(
      [
        'const memo = (fn) => fn;',
        'const Tile = memo(function Tile({ id }) { return <i>{id}</i>; });',
        'export function List({ id }) {',
        '  return <div><Tile id={id} /></div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(comparator).not.toContain('Object.is($[0], id)');
    expect(forwarded).not.toContain('Object.is($[0], id)');
    expect(local).not.toContain('Object.is($[0], id)');
  });

  it('trusts memo by the name and source it is imported from, not by its local name', () => {
    const list = [
      'const Tile = WRAP(function Tile({ id }) { return <i>{id}</i>; });',
      'export function List({ id }) {',
      '  return <div><Tile id={id} /></div>;',
      '}',
      '',
    ];
    const run1 = (importLine: string, call: string): string =>
      run([importLine, ...list].join('\n').replaceAll('WRAP', call));

    const wrongSource = run1("import { wrapper as memo } from './x.js';", 'memo');
    const wrongName = run1("import { other as memo } from 'react';", 'memo');
    const aliased = run1("import { memo as m } from 'react';", 'm');
    const compat = run1("import { memo } from 'preact/compat';", 'memo');
    const member = run1("import React from 'react';", 'React.memo');
    const wrongMember = run1("import React from './x.js';", 'React.memo');

    expect(wrongSource).not.toContain('Object.is($[0], id)');
    expect(wrongName).not.toContain('Object.is($[0], id)');
    expect(wrongMember).not.toContain('Object.is($[0], id)');
    expect(aliased).toContain('Object.is($[0], id)');
    expect(compat).toContain('Object.is($[0], id)');
    expect(member).toContain('Object.is($[0], id)');
  });

  it('keys an element on a string read from an object', () => {
    const code = run(
      [
        "import { Child } from './child';",
        'export function Top({ best }) {',
        '  return <div><Child v={best ? `top: ${best.name}` : "none"} /></div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).toContain('Object.is($[0], best)');
    expect(code).toContain('$[1] = best ? `top: ${best.name}` : "none";');
  });

  it('does not hoist a key expression that reads hidden state', () => {
    const code = run(
      [
        "import { Child } from './child';",
        'export function Top({ best }) {',
        '  return <div><Child v={`${best.name}${globalThis.level}`} /></div>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(code).not.toContain('Object.is($[0], best)');
  });
});
