import { describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { readSet } from '../src/corpus.ts';

describe('tuning corpus with uncompiled output', () => {
  it('has at least 19 cases and a one-line description for each', () => {
    const cases = readSet('tuning');
    expect(cases.length).toBeGreaterThanOrEqual(19);
    for (const testCase of cases) {
      const { tests } = testCase.meta;
      expect(typeof tests, `${testCase.name} tests`).toBe('string');
      expect(tests?.includes('\n'), `${testCase.name} tests`).toBe(false);
    }
  });

  it('runs without errors and gives the same HTML on React and Preact', async () => {
    const results = await collect({ sets: ['tuning'], compilers: ['plain'] });
    for (const result of results) {
      const react = result.cells.get('plain@react');
      const preact = result.cells.get('plain@preact');
      for (const cell of [react, preact]) {
        expect(cell?.failure, `${result.name} failure`).toBeUndefined();
        for (const step of cell?.steps ?? []) {
          expect(step.error, `${result.name} ${step.scenario} ${step.step}`).toBeUndefined();
        }
      }

      // A case that targets one runtime has nothing to compare.
      if (react === undefined || preact === undefined) {
        continue;
      }
      expect(preact.steps.length).toBe(react.steps.length);
      for (const [index, step] of react.steps.entries()) {
        expect(preact.steps[index]?.html, `${result.name} ${step.scenario} ${step.step}`).toBe(
          step.html,
        );
      }
    }
  });
});
