import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateMutants } from '../mutate/generate.ts';
import { globalRead } from '../mutate/operators/global-read.ts';
import { installClock, runCell, runMutant, uninstallClock } from '../mutate/run.ts';
import type { NextCompile } from '../src/compilers.ts';
import { readCase } from '../src/corpus.ts';
import { createLoader, loadNextCompile, type Loader } from '../src/loader.ts';
import type { Cell, Target } from '../src/types.ts';

// Review round 2, R1: a `memo` boundary that re-renders does not excuse a stale value
// below it. `cfg` stays the same object, so next caches `<Mid {...cfg} />` and the
// hazard under it keeps its old value although `Box` rendered in that step.
const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/mutate/memo_gap');
const testCase = readCase('fixture', 'memo_gap', FIXTURE);

let loader: Loader;
let compileNext: NextCompile;
const originals = new Map<Target, Cell>();

beforeAll(async () => {
  installClock();
  loader = await createLoader();
  compileNext = (await loadNextCompile(loader)) as NextCompile;
  for (const target of testCase.meta.targets) {
    originals.set(target, await runCell(loader, 'plain', target, testCase, compileNext));
  }
});

afterAll(async () => {
  await loader.close();
  uninstallClock();
});

async function runSite(site: string): Promise<{ failing: number; allowed: number }> {
  const generated = generateMutants(testCase, [globalRead], 100);
  for (const mutant of generated.mutants) {
    if (mutant.variant === 'member' && mutant.site === site) {
      const result = await runMutant(loader, testCase, mutant, originals, ['next'], compileNext);
      let failing = 0;
      let allowed = 0;
      for (const difference of result.differences) {
        if (difference.allowance === null) {
          failing += 1;
        } else {
          allowed += 1;
        }
      }
      return { failing, allowed };
    }
  }
  throw new Error(`no global-read/member mutant at ${site}`);
}

describe('mutate memo marks', () => {
  it('fails a stale value under a memo body that rendered in the step', async () => {
    const result = await runSite('HazardA');
    expect(result.failing).toBeGreaterThan(0);
  });

  it('fails the same stale value with no memo above it', async () => {
    const result = await runSite('HazardB');
    expect(result.failing).toBeGreaterThan(0);
    expect(result.allowed).toBe(0);
  });
});
