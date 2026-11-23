import { describe, expect, it } from 'vitest';
import { collect } from '../src/collect.ts';
import { readSet } from '../src/corpus.ts';

const LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'];

// The second held-out set is opened only when the run names it:
// `pnpm --filter compare test --set heldout2`.
const asked = (process.env.COMPARE_SETS ?? '').split(',').includes('heldout2');

// React writes the `checked` and `value` attributes of controlled inputs and Preact sets the
// properties only. Preact drops an empty `class`, and attribute order differs too. These are
// runtime serialization differences, so they are normalized away. `checked` and `value` are
// dropped on `input` and `textarea` tags only. Other tags keep every attribute.
function normalizeHtml(html: string | undefined): string {
  return (html ?? '').replace(/<([a-z0-9]+)((?:\s[^<>]*?)?)(\/?)>/gi, (_all, tag, attrs, close) => {
    const isField = /^(input|textarea)$/i.test(tag);
    const list = (attrs.match(/\s[\w:-]+(?:="[^"]*")?/g) ?? [])
      .map((attr: string) => attr.trim())
      .filter((attr: string) => {
        if (attr === 'class=""') {
          return false;
        }
        return !(isField && (attr === 'checked=""' || attr.startsWith('value=')));
      })
      .sort();
    return `<${tag}${list.map((attr: string) => ` ${attr}`).join('')}${close}>`;
  });
}

// Only the uncompiled run is used here. `next` and forgetti 0.8 must not run on this set before
// the regate, so the test names `plain` as the only compiler.
describe.skipIf(!asked)('heldout2 corpus with uncompiled output', () => {
  it('has at least 8 cases from 4 sources of 100 to 250 lines with an allowed license', () => {
    const cases = readSet('heldout2');
    expect(cases.length).toBeGreaterThanOrEqual(8);
    const repos = new Set(
      cases.map((testCase) => testCase.meta.source.split('/').slice(0, 5).join('/')),
    );
    expect(repos.size).toBeGreaterThanOrEqual(4);
    for (const testCase of cases) {
      const lines = testCase.source.trimEnd().split('\n').length;
      expect(lines, `${testCase.name} lines`).toBeGreaterThanOrEqual(100);
      expect(lines, `${testCase.name} lines`).toBeLessThanOrEqual(250);
      expect(testCase.meta.source, `${testCase.name} source`).toMatch(/^https:\/\//);
      expect(LICENSES, `${testCase.name} license`).toContain(testCase.meta.license);
    }
  });

  it('runs without errors and gives the same HTML on React and Preact', async () => {
    const results = await collect({ sets: ['heldout2'], compilers: ['plain'] });
    for (const result of results) {
      const react = result.cells.get('plain@react');
      const preact = result.cells.get('plain@preact');
      expect(react, `${result.name} react`).toBeDefined();
      expect(preact, `${result.name} preact`).toBeDefined();
      for (const cell of [react, preact]) {
        expect(cell?.failure, `${result.name} failure`).toBeUndefined();
        expect(cell?.steps.length, `${result.name} steps`).toBeGreaterThan(5);
        for (const step of cell?.steps ?? []) {
          expect(step.error, `${result.name} ${step.scenario} ${step.step}`).toBeUndefined();
        }
      }
      expect(preact?.steps.length).toBe(react?.steps.length);
      for (const [index, step] of (react?.steps ?? []).entries()) {
        expect(
          normalizeHtml(preact?.steps[index]?.html),
          `${result.name} ${step.scenario} ${step.step}`,
        ).toBe(normalizeHtml(step.html));
      }
    }
  });
});
