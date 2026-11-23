import {
  getCellKey,
  RENDER_KEYS,
  type CaseResult,
  type Cell,
  type Compiler,
  type StepResult,
  type Target,
} from './types.ts';

export const MOUNT = '(mount)';

export function getCell(result: CaseResult, compiler: Compiler, target: Target): Cell | undefined {
  return result.cells.get(getCellKey(compiler, target));
}

export function countRenders(step: StepResult): number {
  let total = 0;
  for (const [key, value] of Object.entries(step.counts)) {
    if (RENDER_KEYS.has(key)) {
      total += value;
    }
  }
  return total;
}

export function countRecomputes(step: StepResult): number {
  let total = 0;
  for (const [key, value] of Object.entries(step.counts)) {
    if (!RENDER_KEYS.has(key)) {
      total += value;
    }
  }
  return total;
}

export function getStepKey(step: StepResult): string {
  return `${step.scenario}/${step.step}`;
}

/**
 * Steps where the output differs from the uncompiled output, as `scenario/step` names.
 * A step matches when its HTML and its error are equal. The mount counts as a step.
 * A cell that failed to load reports one `load:` entry.
 */
export function findDifferences(cell: Cell, plain: Cell): string[] {
  const differences: string[] = [];
  if (cell.failure !== undefined) {
    differences.push(`load: ${cell.failure}`);
    return differences;
  }
  const byKey = new Map<string, StepResult>();
  for (const step of cell.steps) {
    byKey.set(getStepKey(step), step);
  }
  for (const expected of plain.steps) {
    const key = getStepKey(expected);
    const actual = byKey.get(key);
    if (actual === undefined || actual.html !== expected.html || actual.error !== expected.error) {
      differences.push(key);
    }
  }
  return differences;
}

/** Child renders plus recomputes over the update steps. The mount is not counted. */
export function sumWork(cell: Cell, plain: Cell): number {
  // The uncompiled run is the yardstick. Without it there is nothing to charge.
  if (plain.failure !== undefined) {
    throw new Error(
      `The uncompiled cell failed to load, so work cannot be summed: ${plain.failure}`,
    );
  }
  // A cell that failed to load is charged as the uncompiled run.
  if (cell.failure !== undefined) {
    return sumWork(plain, plain);
  }

  let total = 0;
  const plainByKey = new Map<string, StepResult>();
  for (const step of plain.steps) {
    plainByKey.set(getStepKey(step), step);
  }
  for (const step of cell.steps) {
    if (step.step === MOUNT) {
      continue;
    }
    // A step that threw has no counts. It is charged as the uncompiled step so it cannot lower the total.
    const used = step.error === undefined ? step : (plainByKey.get(getStepKey(step)) ?? step);
    total += countRenders(used) + countRecomputes(used);
  }
  return total;
}
