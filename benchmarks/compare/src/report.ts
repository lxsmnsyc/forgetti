import {
  countRecomputes,
  countRenders,
  findDifferences,
  getCell,
  getStepKey,
  MOUNT,
} from './metrics.ts';
import {
  getCellKey,
  type CaseResult,
  type Cell,
  type Compiler,
  type StepResult,
  type Target,
} from './types.ts';

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function formatRows(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    for (const [index, cell] of row.entries()) {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    }
  }
  const lines: string[] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (const [index, cell] of row.entries()) {
      cells.push(pad(cell, widths[index] ?? 0));
    }
    lines.push(cells.join(' | ').trimEnd());
  }
  return lines;
}

function getColumns(results: CaseResult[]): [Compiler, Target][] {
  const order: [Compiler, Target][] = [
    ['plain', 'react'],
    ['forgetti-0.8', 'react'],
    ['react-compiler', 'react'],
    ['next', 'react'],
    ['plain', 'preact'],
    ['forgetti-0.8', 'preact'],
    ['next', 'preact'],
  ];
  const columns: [Compiler, Target][] = [];
  for (const [compiler, target] of order) {
    for (const result of results) {
      if (result.cells.has(getCellKey(compiler, target))) {
        columns.push([compiler, target]);
        break;
      }
    }
  }
  return columns;
}

/** One row per case, compiler and target with the size, slot, time and bailout numbers. */
export function formatCompileTable(results: CaseResult[]): string {
  const rows: string[][] = [
    ['case', 'compiler', 'target', 'raw', 'gzip', 'slots', 'ms', 'compiled', 'bailouts'],
  ];
  for (const result of results) {
    for (const [compiler, target] of getColumns(results)) {
      const cell = getCell(result, compiler, target);
      if (cell === undefined) {
        continue;
      }
      const { compile } = cell;
      rows.push([
        `${result.set}/${result.name}`,
        compiler,
        target,
        String(compile.raw),
        String(compile.gz),
        String(compile.slots),
        String(compile.ms),
        compiler === 'plain' ? '-' : `${compile.compiled}/${compile.units}`,
        compiler === 'plain' ? '-' : String(compile.bailouts.length),
      ]);
    }
  }
  return formatRows(rows).join('\n');
}

function findStep(cell: Cell, key: string): StepResult | undefined {
  for (const step of cell.steps) {
    if (getStepKey(step) === key) {
      return step;
    }
  }
  return undefined;
}

function formatStepCell(cell: Cell | undefined, plain: Cell | undefined, key: string): string {
  if (cell === undefined) {
    return '';
  }
  if (cell.failure !== undefined) {
    return 'LOAD ERROR';
  }
  const step = findStep(cell, key);
  if (step === undefined) {
    return 'missing';
  }
  if (step.error !== undefined) {
    return `ERR ${step.error.slice(0, 30)}`;
  }
  const expected = plain === undefined ? undefined : findStep(plain, key);
  const match = expected === undefined || expected.html === step.html ? '' : ' DIFF';
  return `r${countRenders(step)} c${countRecomputes(step)}${match}`;
}

/** One row per scenario step with renders (r), recomputes (c) and an HTML mismatch flag. */
export function formatRuntimeTable(results: CaseResult[]): string {
  const columns = getColumns(results);
  const header = ['scenario'];
  for (const [compiler, target] of columns) {
    header.push(`${compiler}@${target}`);
  }
  const rows: string[][] = [header];
  for (const result of results) {
    // The reference run lists the steps, in order.
    const reference = getCell(result, 'plain', 'react') ?? getCell(result, 'plain', 'preact');
    for (const step of reference?.steps ?? []) {
      if (step.step === MOUNT) {
        continue;
      }
      const key = getStepKey(step);
      const row = [`${result.set}/${result.name}/${key}`];
      for (const [compiler, target] of columns) {
        row.push(
          formatStepCell(getCell(result, compiler, target), getCell(result, 'plain', target), key),
        );
      }
      rows.push(row);
    }
  }
  return formatRows(rows).join('\n');
}

/** Steps and files that differ from the uncompiled output, per compiler and target. */
export function formatDifferences(results: CaseResult[]): string {
  const rows: string[][] = [['compiler', 'target', 'steps', 'files']];
  for (const [compiler, target] of getColumns(results)) {
    if (compiler === 'plain') {
      continue;
    }
    let steps = 0;
    let files = 0;
    for (const result of results) {
      const cell = getCell(result, compiler, target);
      const plain = getCell(result, 'plain', target);
      if (cell !== undefined && plain !== undefined) {
        const count = findDifferences(cell, plain).length;
        steps += count;
        files += count > 0 ? 1 : 0;
      }
    }
    rows.push([compiler, target, String(steps), String(files)]);
  }
  return formatRows(rows).join('\n');
}
