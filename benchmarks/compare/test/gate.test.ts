import { describe, expect, it } from 'vitest';
import { runGate, sumBaselineWork, type Check } from '../src/gate.ts';
import {
  getCellKey,
  type CaseResult,
  type Cell,
  type Compiler,
  type CompileInfo,
  type Target,
} from '../src/types.ts';

interface CellOptions {
  gz?: number;
  compiled?: number;
  units?: number;
  /** Child renders on each update step. */
  child: number[];
  /** HTML on each update step. The uncompiled cells render `<p>a</p>`. */
  html?: string[];
}

function createCell(options: CellOptions): Cell {
  const compile: CompileInfo = {
    code: '',
    raw: options.gz ?? 100,
    gz: options.gz ?? 100,
    slots: 0,
    ms: 0,
    units: options.units ?? 1,
    compiled: options.compiled ?? 1,
    bailouts: [],
  };
  const steps = [{ scenario: 's', step: '(mount)', counts: {}, html: '<p>a</p>' }];
  for (const [index, child] of options.child.entries()) {
    steps.push({
      scenario: 's',
      step: `u${index}`,
      counts: { Child: child },
      html: options.html?.[index] ?? '<p>a</p>',
    });
  }
  return { compile, steps };
}

type Cells = Partial<Record<`${Compiler}@${Target}`, Cell>>;

function createResult(set: string, name: string, cells: Cells): CaseResult {
  const map = new Map<string, Cell>();
  for (const [key, cell] of Object.entries(cells)) {
    const [compiler, target] = key.split('@') as [Compiler, Target];
    map.set(getCellKey(compiler, target), cell);
  }
  return { set, name, cells: map };
}

/** A file where next is below every baseline on both targets. */
function createGoodCells(): Cells {
  return {
    'plain@react': createCell({ gz: 100, compiled: 0, units: 0, child: [3, 3] }),
    'forgetti-0.8@react': createCell({ gz: 300, child: [1, 1] }),
    'react-compiler@react': createCell({ gz: 200, child: [2, 1] }),
    'next@react': createCell({ gz: 150, child: [1, 1] }),
    'plain@preact': createCell({ gz: 100, compiled: 0, units: 0, child: [3, 3] }),
    'forgetti-0.8@preact': createCell({ gz: 300, child: [1, 1] }),
    'next@preact': createCell({ gz: 150, child: [1, 1] }),
  };
}

function getFailed(checks: Check[]): string[] {
  const names: string[] = [];
  for (const check of checks) {
    if (!check.passed) {
      names.push(check.name);
    }
  }
  return names;
}

function getDetail(checks: Check[], name: string): string | undefined {
  for (const check of checks) {
    if (check.name === name) {
      return check.detail;
    }
  }
  return undefined;
}

describe('sumBaselineWork', () => {
  it('replaces a wrong step with the uncompiled count', () => {
    const plain = createCell({ child: [3, 4] });
    const rc = createCell({ child: [0, 1], html: ['<p>stale</p>', '<p>a</p>'] });
    expect(sumBaselineWork(rc, plain)).toEqual({ work: 4, replaced: ['s/u0 (0 -> 3)'] });
  });
});

describe('gate', () => {
  it('passes when every threshold holds, on all sets and on heldout2', () => {
    const results = [
      createResult('heldout', 'a', createGoodCells()),
      createResult('heldout2', 'b', createGoodCells()),
    ];
    const checks = runGate(results, ['heldout', 'heldout2']);
    expect(getFailed(checks)).toEqual([]);
    expect(getDetail(checks, 'total work below React Compiler on react (heldout2)')).toBe(
      'next 2, react-compiler (adjusted) 3',
    );
  });

  it('judges React Compiler by its adjusted count', () => {
    // React Compiler renders 0 on a wrong step. Uncompiled renders 3 there, so next's 2 is below.
    const cells = createGoodCells();
    cells['react-compiler@react'] = createCell({ child: [0, 1], html: ['<p>x</p>', '<p>a</p>'] });
    cells['next@react'] = createCell({ child: [2, 1] });
    const checks = runGate([createResult('base', 'a', cells)], ['base']);
    expect(getFailed(checks)).toEqual([]);
    expect(getDetail(checks, 'react-compiler steps replaced by uncompiled counts')).toBe(
      'base/a: s/u0 (0 -> 3)',
    );
  });

  it('fails a file above React Compiler on react and above uncompiled on preact', () => {
    const cells = createGoodCells();
    cells['next@react'] = createCell({ child: [3, 1] });
    cells['next@preact'] = createCell({ child: [4, 3] });
    const results = [
      createResult('heldout', 'a', createGoodCells()),
      createResult('heldout2', 'b', cells),
    ];
    const failed = getFailed(runGate(results, ['heldout', 'heldout2']));
    // On all sets next ties React Compiler (6 and 6) and stays below uncompiled on Preact (9 and 12).
    expect(failed).toEqual([
      'total work below React Compiler on react (all sets)',
      'no file above React Compiler on react (all sets)',
      'no file above uncompiled on preact (all sets)',
      'total work below React Compiler on react (heldout2)',
      'no file above React Compiler on react (heldout2)',
      'total work below uncompiled on preact (heldout2)',
      'no file above uncompiled on preact (heldout2)',
    ]);
  });

  it('fails on a difference, on size and on share', () => {
    const cells = createGoodCells();
    cells['next@react'] = createCell({ gz: 260, compiled: 0, child: [1, 1], html: ['<p>b</p>'] });
    const failed = getFailed(runGate([createResult('heldout', 'a', cells)], ['heldout']));
    expect(failed).toEqual([
      'soundness on react (all sets)',
      'total gzip at most 1 x React Compiler (all sets)',
      'no file above 1.15 x React Compiler gzip (all sets)',
      "compiled share at least React Compiler's on held-out files (all sets)",
    ]);
  });

  it('reports forgetti 0.8 without failing, and lists files where it is sound and lower', () => {
    const cells = createGoodCells();
    cells['forgetti-0.8@react'] = createCell({ child: [0, 0] });
    cells['forgetti-0.8@preact'] = createCell({ child: [0, 1], html: ['<p>x</p>'] });
    const checks = runGate([createResult('base', 'a', cells)], ['base']);
    expect(getFailed(checks)).toEqual([]);
    expect(getDetail(checks, 'forgetti-0.8 sound and below next on react')).toBe(
      'base/a next 2 > forgetti-0.8 0',
    );
    expect(getDetail(checks, 'forgetti-0.8 wrong steps on preact')).toBe('base/a: s/u0');
  });
});
