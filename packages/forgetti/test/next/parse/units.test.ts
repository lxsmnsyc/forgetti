import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as babel from '@babel/core';
import { describe, it, vi } from 'vitest';
import plugin from '../../../src';
import { parseAndScope } from '../../../src/next/parse';

// 0.8 hands each unit it compiles to `new Optimizer(ctx, path)`. Recording those nodes,
// with the optimizer itself stubbed out, gives the exact list of units 0.8 finds.
const recorded = vi.hoisted(() => ({ starts: [] as number[] }));

vi.mock('../../../src/core/optimizer', () => ({
  default: class {
    constructor(_ctx: unknown, path: { node: { start?: number | null } }) {
      recorded.starts.push(path.node.start ?? -1);
    }

    // 0.8 calls `optimize()` on the instance, so it cannot be static.
    // oxlint-disable-next-line class-methods-use-this
    optimize(): void {}
  },
}));

const CORPUS = join(import.meta.dirname, '../../../../../benchmarks/corpus/base');

function findLegacyUnits(code: string, preset: 'react' | 'preact' = 'react'): number[] {
  recorded.starts = [];
  babel.transformSync(code, {
    plugins: [[plugin, { preset }]],
    parserOpts: { plugins: ['jsx'] },
    babelrc: false,
    configFile: false,
  });
  return [...recorded.starts].sort((a, b) => a - b);
}

function findNextUnits(code: string, preset: 'react' | 'preact' = 'react'): number[] {
  const result = parseAndScope(code, { filename: 'input.jsx', preset });
  return result.units
    .filter((unit) => !unit.skip)
    .map((unit) => unit.node.start)
    .sort((a, b) => a - b);
}

describe('units match 0.8 on the base corpus', () => {
  const entries = readdirSync(CORPUS, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );

  it('has corpus files', ({ expect }) => {
    expect(entries.length).toBeGreaterThanOrEqual(15);
  });

  for (const entry of entries) {
    it(entry.name, ({ expect }) => {
      const code = readFileSync(join(CORPUS, entry.name, 'input.jsx'), 'utf8');
      const legacy = findLegacyUnits(code);
      expect(legacy.length).toBeGreaterThan(0);
      expect(findNextUnits(code)).toEqual(legacy);
    });
  }
});

const CASES: Record<string, string> = {
  'function declaration': `function Foo() { return 1; }`,
  'lowercase function': `function foo() { return 1; }`,
  hook: `function useThing(a) { return a; }`,
  'arrow in const': `const Foo = (props) => props.a;`,
  'function expression in let': `let Foo = function () { return 1; };`,
  'named function expression': `const foo = function Bar() { return 1; };`,
  'function expression named after a lowercase variable': `const x = function useX() {};`,
  'async and generator': `async function Foo() {} function* Bar() {} const Baz = async () => {};`,
  'memo HOC': `import { memo } from 'react'; const Foo = memo((props) => props.a);`,
  'forwardRef HOC with a lowercase variable': `import { forwardRef } from 'react'; const x = forwardRef(function (props, ref) { return null; });`,
  'nested HOCs': `import { memo, forwardRef } from 'react'; export default memo(forwardRef((p, r) => null));`,
  'renamed HOC import': `import { memo as m } from 'react'; const a = m(() => null);`,
  'namespace HOC': `import * as React from 'react'; const a = React.memo(() => null);`,
  'default import is not a namespace': `import React from 'react'; const a = React.memo(() => null);`,
  'HOC from another module': `import { memo } from 'other'; const a = memo(() => null);`,
  'shadowed HOC': `import { memo } from 'react'; function f(memo) { return memo(() => null); }`,
  'HOC called with a reference': `import { memo } from 'react'; function x() {} const a = memo(x);`,
  'nested component': `function Outer() { function Inner() { return 1; } return Inner; }`,
  'object method and class method': `const o = { Foo() {} }; class K { Bar() {} }`,
  'skip on function declaration': `/* @forgetti skip */\nfunction Foo() {}\nfunction Bar() {}`,
  'skip on variable declaration': `/* @forgetti skip */\nconst Foo = () => null;`,
  'skip as a line comment': `// @forgetti skip\nfunction Foo() {}`,
  'unrelated comment': `/* hello */\nfunction Foo() {}`,
};

describe('units match 0.8 on edge cases', () => {
  for (const [name, code] of Object.entries(CASES)) {
    it(name, ({ expect }) => {
      expect(findNextUnits(code)).toEqual(findLegacyUnits(code));
    });
  }

  // compiler-api sets the hook filter to `^use[A-Z0-9]`. 0.8 uses `^use[A-Z]`.
  it('accepts a digit after use, unlike 0.8', ({ expect }) => {
    const code = `function use2(a) { return a; }`;
    expect(findLegacyUnits(code)).toEqual([]);
    expect(findNextUnits(code)).toEqual([0]);
  });

  it('uses the preact HOC source', ({ expect }) => {
    const code = `import { memo } from 'preact/compat'; const A = memo(() => null);`;
    expect(findNextUnits(code, 'preact')).toEqual(findLegacyUnits(code, 'preact'));
    expect(findNextUnits(code, 'preact')).toHaveLength(1);
  });
});

describe('unit fields', () => {
  it('names and kinds', ({ expect }) => {
    const code = `
import { memo, forwardRef } from 'react';
function Foo() {}
const useBar = () => {};
const Baz = memo(function () {});
export default forwardRef(() => null);
const Named = memo(function Inner() {});
`;
    const { units } = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    expect(units.map((unit) => [unit.id, unit.kind, unit.name])).toEqual([
      [0, 'component', 'Foo'],
      [1, 'hook', 'useBar'],
      [2, 'component', 'Baz'],
      [3, 'component', 'default'],
      [4, 'component', 'Inner'],
    ]);
  });

  it('keeps skipped units with skip set', ({ expect }) => {
    const code = `/* @forgetti skip */\nexport function Foo() {}\nexport const Bar = () => null;`;
    const { units } = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    expect(units.map((unit) => [unit.name, unit.skip])).toEqual([
      ['Foo', true],
      ['Bar', false],
    ]);
  });

  it('does not carry a skip comment into a nested function', ({ expect }) => {
    const code = `import { memo } from 'react';\n/* @forgetti skip */\nconst useX = () => memo(() => null);`;
    const { units } = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    expect(units.map((unit) => [unit.name, unit.skip])).toEqual([
      ['useX', true],
      ['anonymous', false],
    ]);
  });

  it('applies a skip comment between export and the declaration', ({ expect }) => {
    const code = `export /* @forgetti skip */ function Foo() {}`;
    const { units } = parseAndScope(code, { filename: 'input.jsx', preset: 'react' });
    expect(units[0].skip).toBe(true);
  });

  it('accepts a custom preset', ({ expect }) => {
    const code = `function Foo() {} function $bar() {}`;
    const { units } = parseAndScope(code, {
      filename: 'input.jsx',
      preset: {
        filters: { component: { source: '^\\$', flags: '' } },
        runtime: { useRef: { kind: 'named', name: 'useRef', source: 'react' } },
        imports: { hooks: [], hocs: [] },
      },
    });
    expect(units.map((unit) => unit.name)).toEqual(['$bar']);
  });

  it('throws on a parse error', ({ expect }) => {
    expect(() => parseAndScope('const = 1;', { filename: 'input.js', preset: 'react' })).toThrow(
      /\(at \d+\)$/,
    );
  });
});
