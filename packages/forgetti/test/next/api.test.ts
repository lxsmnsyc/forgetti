import { describe, expect, it } from 'vitest';
import { EMPTY, branch, keep, useCache } from '../../runtime/next';
import { compile } from '../../src/next';
import type { CacheNode, CachePlan, ScopeResult } from '../../src/next/ir';
import { analyzeOwnership } from '../../src/next/ownership';
import { passes, runPlanPasses } from '../../src/next/plan';
import { plan as derived, source as derivedSource } from './fixtures/derived.plan';
import { plan as map, source as mapSource } from './fixtures/map.plan';
import { plan as ternary, source as ternarySource } from './fixtures/ternary.plan';

describe('compile stub', () => {
  it('returns the input and lists units from a name scan', () => {
    const code = [
      "import { useState } from 'react';",
      'export function Card({ title }) { return <h1>{title}</h1>; }',
      'export const useCount = () => useState(0);',
      'function helper() { return 1; }',
      '',
    ].join('\n');
    const result = compile(code, { preset: 'react', filename: 'card.jsx' });

    expect(result.code).toBe(code);
    expect(result.map).toBeNull();
    expect(result.diagnostics).toEqual([]);
    expect(result.units).toEqual([
      { name: 'Card', compiled: false },
      { name: 'useCount', compiled: false },
    ]);
  });

  it('keeps non-ASCII input byte for byte', () => {
    const code = 'const note = "é 日本語 😀";\nexport function Label() { return <p>{note}</p>; }\n';
    const result = compile(code, { preset: 'react', filename: 'label.jsx' });

    expect(result.code).toBe(code);
    expect(result.units).toEqual([{ name: 'Label', compiled: false }]);
  });

  it('reports parse error offsets as UTF-16 indices', () => {
    // The emoji is two UTF-16 units and four UTF-8 bytes, so the two offsets differ.
    const code = 'const s = "😀";\nconst = ;\n';
    const expected = code.indexOf('= ;');

    expect(() => compile(code, { preset: 'react', filename: 'bad.js' })).toThrow(
      `(at ${expected})`,
    );
  });

  it('reads component filters from a custom preset', () => {
    const code = 'function widget() {}\nfunction Skip() {}\n';
    const result = compile(code, {
      filename: 'a.js',
      preset: {
        filters: { component: { source: '^[a-z]', flags: '' } },
        runtime: { useRef: { kind: 'named', name: 'useRef', source: 'react' } },
        imports: { hooks: [], hocs: [] },
      },
    });

    expect(result.units).toEqual([{ name: 'widget', compiled: false }]);
  });
});

function collectNodes(node: CacheNode, found: CacheNode[]): void {
  found.push(node);
  for (const child of node.children) {
    collectNodes(child, found);
  }
}

describe('plan fixtures', () => {
  const fixtures: [string, string, CachePlan][] = [
    ['ternary', ternarySource, ternary],
    ['derived', derivedSource, derived],
    ['map', mapSource, map],
  ];

  for (const [name, source, plan] of fixtures) {
    it(`${name}: ranges lie inside their parent and inside the source`, () => {
      const nodes: CacheNode[] = [];
      collectNodes(plan.root, nodes);

      for (const node of nodes) {
        expect(node.range.start).toBeGreaterThanOrEqual(0);
        expect(node.range.end).toBeLessThanOrEqual(source.length);
        for (const child of node.children) {
          expect(child.range.start).toBeGreaterThanOrEqual(node.range.start);
          expect(child.range.end).toBeLessThanOrEqual(node.range.end);
        }
      }
    });

    it(`${name}: slot counts add up`, () => {
      const nodes: CacheNode[] = [];
      collectNodes(plan.root, nodes);

      for (const node of nodes) {
        const used = new Set<number>();
        for (const block of node.blocks) {
          const count = block.kind === 'keep' ? 1 : block.inputs.length + block.outputs.length;
          for (let slot = block.first; slot < block.first + count; slot++) {
            expect(used.has(slot)).toBe(false);
            used.add(slot);
          }
        }
        for (const child of node.children) {
          expect(child.parentIndex).toBeDefined();
          expect(used.has(child.parentIndex ?? -1)).toBe(false);
          used.add(child.parentIndex ?? -1);
        }
        expect(used.size).toBeLessThanOrEqual(node.size);
      }
    });
  }

  it('covers a branch node, an iteration node and a keep block', () => {
    const nodes: CacheNode[] = [];
    for (const plan of [ternary, derived, map]) {
      collectNodes(plan.root, nodes);
    }
    const kinds = new Set(nodes.map((node) => node.kind));
    const blockKinds = new Set(nodes.flatMap((node) => node.blocks.map((block) => block.kind)));

    expect(kinds).toEqual(new Set(['root', 'branch', 'iteration']));
    expect(blockKinds.has('keep')).toBe(true);
  });

  it('slices the derived output range to the JSX it replaces', () => {
    const range = derived.root.blocks[2].outputs[0].range;

    expect(derivedSource.slice(range.start, range.end)).toBe('<div>{x}-{y}-{z}</div>');
  });
});

describe('planner and ownership stubs', () => {
  it('lists the four planner passes in order', () => {
    expect(passes.map((pass) => pass.name)).toEqual(['baseline', 'groups', 'branches', 'loops']);
  });

  it('returns the plan unchanged and no groups', () => {
    // The stubs never read the scope.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const scope = { units: [], bindings: [], scopes: [] } as unknown as ScopeResult;
    const ownership = analyzeOwnership(scope, 0);

    expect(ownership).toEqual({ unit: 0, groups: [], opaque: [] });
    expect(runPlanPasses(scope, ownership, ternary)).toBe(ternary);
  });
});

describe('runtime', () => {
  it('useCache fills EMPTY once and reuses the array', () => {
    const ref = { current: null as unknown };
    const useRef = <T>(initial: T): { current: T } => {
      ref.current ??= initial;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return ref as { current: T };
    };
    const first = useCache(useRef, 3);
    const second = useCache(useRef, 3);

    expect(first).toEqual([EMPTY, EMPTY, EMPTY]);
    expect(second).toBe(first);
  });

  it('branch creates a child once, including past the parent length', () => {
    const parent: unknown[] = [];
    const child = branch(parent, 2, 2);

    expect(child).toEqual([EMPTY, EMPTY]);
    expect(branch(parent, 2, 2)).toBe(child);
  });

  it('keep returns the stored array while elements are Object.is equal', () => {
    const cache: unknown[] = [EMPTY];
    const first = keep(cache, 0, [1, NaN]);

    expect(keep(cache, 0, [1, NaN])).toBe(first);
    expect(keep(cache, 0, [1, 2])).not.toBe(first);
    expect(keep(cache, 0, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
