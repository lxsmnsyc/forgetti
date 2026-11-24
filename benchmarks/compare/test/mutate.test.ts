import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEdits, insert, parseFile } from '../mutate/ast.ts';
import { generateMutants } from '../mutate/generate.ts';
import { OPERATORS } from '../mutate/operators/index.ts';
import { readOptions } from '../mutate/options.ts';
import { matchesBehindMemo, unwrapMemoMarks } from '../mutate/run.ts';
import type { CorpusCase } from '../src/types.ts';

// One file with every pattern an operator looks for.
const SOURCE = `import { memo, forwardRef } from 'react';
import { bump } from '../../shared/counter.js';
function format(value) { return new Date(value).toISOString(); }
const Label = forwardRef(({ text }, ref) => <span ref={ref}>{text}</span>);
Label.displayName = 'Label';
export function List({ items, selected, title, style = {} }) {
  const current = items.find((item) => item.id === selected);
  const open = items.filter((item) => item.open);
  return (
    <ul title={title} style={{ color: 'red' }}>
      <Label text={format(0)} />
      {items.map((item) => <li key={item.id}>{item.name}</li>)}
      {current ? current.name : ''}
      {open.length}
    </ul>
  );
}
export const Arrow = memo(({ a }) => (
  <p>{a}</p>
));
`;

function createCase(source: string): CorpusCase {
  return {
    set: 'fixture',
    name: 'all',
    dir: path.join(import.meta.dirname, 'fixtures'),
    inputFile: 'input.jsx',
    source,
    siblings: [],
    meta: { source: 'test', license: 'MIT', targets: ['react'] },
  };
}

describe('mutate', () => {
  it('applies insertions at one position in bias order', () => {
    const code = 'ab';
    const edits = [insert(1, ')', 10), insert(1, '(', 0), insert(1, 'x')];
    expect(applyEdits(code, edits)).toBe('a(x)b');
  });

  it('finds components, exported ones first', () => {
    const file = parseFile('fixture/all', SOURCE, 'input.jsx');
    const names: string[] = [];
    for (const component of file.components) {
      names.push(component.name);
    }
    expect(names).toEqual(['List', 'Arrow', 'Label']);
    // `Arrow` is a memo export; `Label` renders on every `List` render.
    expect([...file.behindMemo]).toEqual(['Arrow']);
  });

  it('gives every operator at least one mutant, and every mutant parses', () => {
    const generated = generateMutants(createCase(SOURCE), OPERATORS, 100);
    expect(generated.dropped).toEqual([]);
    const variants = new Set<string>();
    for (const mutant of generated.mutants) {
      variants.add(`${mutant.operator}/${mutant.variant}`);
    }
    for (const operator of OPERATORS) {
      expect([...variants].some((key) => key.startsWith(`${operator.name}/`))).toBe(true);
    }
    for (const key of [
      'callback-mutate/map',
      'callback-mutate/filter',
      'callback-mutate/find',
      'result-mutate/find',
      'identity-write/cond',
      'identity-write/fn',
      'identity-write/handler',
      'fresh-literal/attribute',
      'date-arg/arg',
      'default-param/existing-default',
      'default-param/existing-passed',
      'default-param/added',
      'child-impure/memo-ref',
    ]) {
      expect(variants.has(key)).toBe(true);
    }
  });

  it('turns an arrow expression body into a block when it prepends', () => {
    const file = parseFile('fixture/all', SOURCE, 'input.jsx');
    let arrow = null;
    for (const component of file.components) {
      if (component.name === 'Arrow') {
        arrow = component;
      }
    }
    expect(arrow).not.toBe(null);
    // Two prepends share one block.
    const edits = [...(arrow?.prepend('a1();') ?? []), ...(arrow?.prepend('a2();') ?? [])];
    expect(applyEdits(SOURCE, edits)).toContain('=> { a1(); a2(); return ((');
  });

  it('keeps the first candidates of each variant up to the cap', () => {
    const generated = generateMutants(createCase(SOURCE), OPERATORS, 1);
    const seen = new Set<string>();
    for (const mutant of generated.mutants) {
      const key = `${mutant.operator}/${mutant.variant}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(mutant.index).toBe(0);
    }
    expect(generated.capped.get('alias-prop-call/call')).toBeGreaterThan(0);
  });

  it('refuses the sealed set and defaults to the development sets and next', () => {
    expect(() => readOptions(['--set', 'base,heldout3'])).toThrow(/sealed/);
    const options = readOptions([]);
    expect(options.sets).toEqual(['base', 'tuning', 'heldout', 'heldout2']);
    expect(options.compilers).toEqual(['next']);
    expect(options.cap).toBe(Infinity);
    expect(options.jobs).toBe(4);
  });

  it('allows a difference only inside a memo mark that skipped the step', () => {
    const plain = '<p>3<mut-memo data-s="3">new<mut-memo data-s="3">x</mut-memo></mut-memo></p>';
    // Step 3: the outer body skipped (stamp 2), so its contents may be stale.
    expect(
      matchesBehindMemo(
        plain,
        '<p>3<mut-memo data-s="2">old<mut-memo data-s="2">y</mut-memo></mut-memo></p>',
        3,
      ),
    ).toBe(true);
    // The body rendered in step 3, so stale contents below it fail.
    expect(
      matchesBehindMemo(
        plain,
        '<p>3<mut-memo data-s="3">old<mut-memo data-s="3">x</mut-memo></mut-memo></p>',
        3,
      ),
    ).toBe(false);
    // Outside the marks everything must match.
    expect(matchesBehindMemo(plain, plain.replace('<p>3', '<p>2'), 3)).toBe(false);
    expect(unwrapMemoMarks(plain)).toBe('<p>3newx</p>');

    // A hazard in the memo export gets its memo body stamped.
    const generated = generateMutants(createCase(SOURCE), OPERATORS, 100);
    let marked = false;
    for (const mutant of generated.mutants) {
      if (mutant.operator === 'global-read' && mutant.site === 'Arrow') {
        marked = true;
        expect(mutant.exempt).toContain('Arrow');
        expect(mutant.source).toContain('<mut-memo data-s={globalThis.__mutG}>');
      }
    }
    expect(marked).toBe(true);
  });

  it('flags mutants that write to values reached through props', () => {
    const generated = generateMutants(createCase(SOURCE), OPERATORS, 100);
    const flags = new Map<string, boolean>();
    for (const mutant of generated.mutants) {
      flags.set(`${mutant.operator}/${mutant.variant}@${mutant.site}`, mutant.propsMutation);
    }
    // `items` is a prop of `List`: its elements and a found element belong to props.
    expect(flags.get('alias-prop-call/call@List:items')).toBe(true);
    expect(flags.get('callback-mutate/map@List:12')).toBe(true);
    expect(flags.get('callback-mutate/filter@List:8')).toBe(true);
    expect(flags.get('result-mutate/find@List:7')).toBe(true);
    // `filter` returns the component's own array, and `__mutOpt` is never passed.
    expect(flags.get('result-mutate/filter@List:8')).toBe(false);
    expect(flags.get('default-param/added@List')).toBe(false);
    // A fresh default changed only when it is used is the component's own (census D).
    expect(flags.get('default-param/existing-default@List:style')).toBe(false);
    expect(flags.get('default-param/existing-passed@List:style')).toBe(true);
  });

  it('refuses a file that already uses a mutant name', () => {
    expect(() => generateMutants(createCase('const __mutKey = 1;'), OPERATORS, 1)).toThrow(/__mut/);
  });
});
