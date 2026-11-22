import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as derived from '../fixtures/derived.plan';
import * as map from '../fixtures/map.plan';
import * as ternary from '../fixtures/ternary.plan';
import type { CachePlan } from '../../../src/next/ir';
import type { Props } from './harness';
import { PROOF_T2, emitPlan, loadModule, prepareOutDir, removeOutDir, runSteps } from './harness';

beforeAll(prepareOutDir);
afterAll(removeOutDir);

const items = [
  { id: 1, name: 'n1' },
  { id: 2, name: 'n2' },
  { id: 3, name: 'n3' },
];

// The scenarios of `debate/evidence/proof-t2/runtime.mjs`: mount the base props, then one update.
interface T2Case {
  name: string;
  fixture: { source: string; plan: CachePlan };
  names: string[];
  component: string;
  base: Props;
  updates: Record<string, Props>;
}

const cases: T2Case[] = [
  {
    name: 'ternary',
    fixture: ternary,
    names: ['ok', 'a', 'b'],
    component: 'Ternary',
    base: { ok: true, a: 1, b: 2 },
    updates: {
      same: { ok: true, a: 1, b: 2 },
      inactive_b: { ok: true, a: 1, b: 3 },
      active_a: { ok: true, a: 7, b: 2 },
      flip: { ok: false, a: 1, b: 2 },
    },
  },
  {
    name: 'derived',
    fixture: derived,
    names: ['a', 'b', 'x', 'y', 'z'],
    component: 'Derived',
    base: { a: 1, b: 2 },
    updates: { same: { a: 1, b: 2 }, one_b: { a: 1, b: 3 }, one_a: { a: 5, b: 2 } },
  },
  {
    name: 'map',
    fixture: map,
    names: ['items', 'title', 'item'],
    component: 'MapList',
    base: { items, title: 't' },
    updates: {
      same: { items, title: 't' },
      one_title: { items, title: 'u' },
      deep_item: { items: [items[0], { id: 2, name: 'changed' }, items[2]], title: 't' },
      append: { items: [...items, { id: 4, name: 'n4' }], title: 't' },
    },
  },
];

function readHand(name: string): string {
  return readFileSync(path.join(PROOF_T2, 'hand', `${name}.jsx`), 'utf8');
}

describe.each(cases)('$name', (testCase) => {
  const emitted = emitPlan(testCase.fixture.source, testCase.fixture.plan, testCase.names);

  it.each(Object.entries(testCase.updates))(
    '%s renders like the hand output',
    async (_, update) => {
      const steps = [testCase.base, update];
      const plain = await runSteps(
        await loadModule(testCase.fixture.source),
        testCase.component,
        steps,
      );
      const hand = await runSteps(
        await loadModule(readHand(testCase.name)),
        testCase.component,
        steps,
      );
      const next = await runSteps(await loadModule(emitted), testCase.component, steps);
      expect(next.map((step) => step.html)).toEqual(plain.map((step) => step.html));
      expect(next).toEqual(hand);
    },
  );

  it('skips the work of a same-props update', async () => {
    const steps = [testCase.base, testCase.updates.same];
    const plain = await runSteps(
      await loadModule(testCase.fixture.source),
      testCase.component,
      steps,
    );
    const next = await runSteps(await loadModule(emitted), testCase.component, steps);
    expect(plain[1].counts).not.toEqual({});
    expect(next[1].counts).toEqual({});
  });

  it('emits the runtime calls of the plan', () => {
    expect(emitted).toContain('useCache(useRef, ');
    if (testCase.name !== 'derived') {
      expect(emitted).toContain('branch(');
    }
    if (testCase.name === 'map') {
      expect(emitted).toContain('keep($, 1, ');
    }
  });
});

describe('raw bytes against proof T2 hand output', () => {
  it.each(['ternary', 'derived'] as const)('%s is within 10%%', (name) => {
    const testCase = cases.find((item) => item.name === name);
    if (!testCase) {
      throw new Error(name);
    }
    const emitted = emitPlan(testCase.fixture.source, testCase.fixture.plan, testCase.names);
    // The test writes an absolute runtime path. Measure with the published specifier.
    const shipped = emitted.replace(/from '[^']*next\.ts'/, "from 'forgetti/runtime'");
    const ratio = Buffer.byteLength(shipped) / Buffer.byteLength(readHand(name));
    expect(ratio).toBeLessThanOrEqual(1.1);
  });
});
