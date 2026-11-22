import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preactAdapter, reactAdapter } from './runtime/adapters';
import { runScenario } from './runtime/scenarios';
import type { Adapter, Result, ScenarioName, Variant } from './runtime/scenarios';

// Contract tests for `runtime-api`: proof T1 on React 19.3 and Preact 11.2.
// The component is rendered uncompiled and with hand-written slot code that follows the write
// rule (a value is computed into a local, then its inputs and value are written together).

// React warns about discarded renders and the thrown errors on purpose.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Each run waits out React's Suspense throttle, and every scenario runs five times.
const TIMEOUT = 120_000;

const MATCHING: Variant[] = ['valueFirst', 'memo', 'branch'];

const REACT_SCENARIOS: ScenarioName[] = [
  'simple',
  'interrupt',
  'mount',
  'update',
  'throw',
  'later',
  'transition',
];

// Preact cannot interrupt a render. Its Suspense handles a thrown promise, so `update` applies.
const PREACT_SCENARIOS: ScenarioName[] = [
  'simple',
  'mount',
  'update',
  'throw',
  'later',
  'transition',
];

/** The uncompiled run must reach the state each scenario is about, or a match proves nothing. */
function expectReached(scenario: ScenarioName, plain: Result): void {
  const html = plain.snaps.join('\n');
  if (scenario === 'mount') {
    expect(plain.snaps[0]).toContain('<b>FB</b>');
    expect(plain.snaps[1]).toContain('<p>A5|5q|D5q</p>');
  } else if (scenario === 'update') {
    expect(html).toContain('<b>FB</b>');
    expect(plain.snaps.find((snap) => snap.startsWith('r resolved'))).toContain('<p>A6|6x|D6x</p>');
  } else if (scenario === 'interrupt') {
    expect(plain.log).toContain('-- urgent');
    expect(plain.snaps.at(-1)).toContain('<p>A3|3y|D3y</p>');
  } else if (scenario === 'throw') {
    expect(html).toContain('ERR:bad f1');
    expect(plain.snaps.at(-1)).toContain('<p>A1|1x|D1x</p>');
  } else if (scenario === 'later') {
    expect(plain.snaps.at(-1)).toContain('ERR:later');
  } else if (scenario === 'transition') {
    expect(plain.snaps.at(-1)).toContain('ERR:bad f1');
  } else {
    expect(plain.snaps.at(-1)).toContain('<p>A2|2z|D2z</p>');
  }
}

function describeMatrix(adapter: Adapter, scenarios: ScenarioName[], stricts: boolean[]): void {
  describe(adapter.name, () => {
    for (const strict of stricts) {
      for (const scenario of scenarios) {
        it(
          `${scenario}${strict ? ' in StrictMode' : ''} matches uncompiled output`,
          async () => {
            const plain = await runScenario(adapter, 'plain', scenario, strict);
            expectReached(scenario, plain);
            for (const variant of MATCHING) {
              const result = await runScenario(adapter, variant, scenario, strict);
              expect(result.snaps, `${variant} html`).toEqual(plain.snaps);
              expect(result.log, `${variant} log`).toEqual(plain.log);
            }
          },
          TIMEOUT,
        );
      }
    }
  });
}

describeMatrix(reactAdapter, REACT_SCENARIOS, [false, true]);
describeMatrix(preactAdapter, PREACT_SCENARIOS, [false]);

describe('write order', () => {
  // Proof T1: with inputs written first, a throw leaves matching inputs next to a stale value.
  // React retries the render at once, so the retry is a hit and renders the stale value.
  for (const scenario of ['throw', 'transition'] as const) {
    it(`inputs first differs from uncompiled output on React (${scenario})`, async () => {
      const plain = await runScenario(reactAdapter, 'plain', scenario, false);
      const broken = await runScenario(reactAdapter, 'inputsFirst', scenario, false);
      expect(broken.log).not.toEqual(plain.log);
      // The retry hits on the stored inputs and renders the value of the earlier props.
      expect(broken.log).toContain('body 1bad -> A1,1x,D1x');
    });
  }
});
