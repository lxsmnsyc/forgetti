import { describe, expect, it } from 'vitest';
import { runGate } from '../src/gate.ts';
import {
  getCellKey,
  type CaseResult,
  type Cell,
  type Compiler,
  type CompileInfo,
} from '../src/types.ts';

function createCell(options: {
  gz: number;
  compiled: number;
  units: number;
  child: number;
  html?: string;
}): Cell {
  const compile: CompileInfo = {
    code: '',
    raw: options.gz,
    gz: options.gz,
    slots: 0,
    ms: 0,
    units: options.units,
    compiled: options.compiled,
    bailouts: [],
  };
  return {
    compile,
    steps: [
      { scenario: 's', step: '(mount)', counts: {}, html: '<p>a</p>' },
      {
        scenario: 's',
        step: 'u',
        counts: { Child: options.child },
        html: options.html ?? '<p>a</p>',
      },
    ],
  };
}

function createResult(cells: Partial<Record<Compiler, Cell>>): CaseResult {
  const map = new Map<string, Cell>();
  for (const [compiler, cell] of Object.entries(cells)) {
    map.set(getCellKey(compiler as Compiler, 'react'), cell);
  }
  return { set: 'heldout', name: 'case', cells: map };
}

const baselines = {
  plain: createCell({ gz: 100, compiled: 0, units: 0, child: 3 }),
  'forgetti-0.8': createCell({ gz: 300, compiled: 1, units: 1, child: 2 }),
  'react-compiler': createCell({ gz: 200, compiled: 1, units: 1, child: 1 }),
};

describe('gate', () => {
  it('passes when every threshold holds', () => {
    const next = createCell({ gz: 150, compiled: 1, units: 1, child: 0 });
    const checks = runGate([createResult({ ...baselines, next })], ['heldout']);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
  });

  it('fails on a difference, on work at the baseline, on size and on share', () => {
    const next = createCell({ gz: 260, compiled: 0, units: 1, child: 1, html: '<p>b</p>' });
    const checks = runGate([createResult({ ...baselines, next })], ['heldout']);
    const failed = checks.filter((check) => !check.passed).map((check) => check.name);
    expect(failed).toEqual([
      'soundness on react',
      'total work below each baseline on react',
      'total gzip at most 1 x React Compiler',
      'no file above 1.15 x React Compiler gzip',
      "compiled share at least React Compiler's on heldout",
    ]);
  });
});
