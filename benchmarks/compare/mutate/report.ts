import type { Generated } from './generate.ts';
import type { Allowance, Difference, MutantResult } from './run.ts';

interface Tally {
  mutants: number;
  live: number;
  inert: number;
  broken: number;
  /** Mutants whose plain run never finished. */
  hung: number;
  /** Mutants with a difference that fails the check. */
  failing: number;
  /** Mutants whose only differences are allowed behind `memo`. */
  memo: number;
  /** Mutants whose differences come from changing props (out of contract). */
  props: number;
  capped: number;
}

const COLUMNS = ['mutants', 'live', 'inert', 'broken', 'hung', 'failing', 'memo', 'props'] as const;

function createTally(): Tally {
  return {
    mutants: 0,
    live: 0,
    inert: 0,
    broken: 0,
    hung: 0,
    failing: 0,
    memo: 0,
    props: 0,
    capped: 0,
  };
}

/** True when the difference fails the check. */
export function isFailing(difference: Difference): boolean {
  return difference.allowance === null;
}

function addResult(tally: Tally, result: MutantResult): void {
  tally.mutants += 1;
  if (result.broken !== null) {
    tally.broken += 1;
  } else if (result.hung !== null) {
    tally.hung += 1;
  } else if (result.inert) {
    tally.inert += 1;
  } else {
    tally.live += 1;
  }
  // A mutant counts once: failing beats props, props beats memo.
  let failing = false;
  let props = false;
  for (const difference of result.differences) {
    if (isFailing(difference)) {
      failing = true;
    } else if (difference.allowance === 'props') {
      props = true;
    }
  }
  if (failing) {
    tally.failing += 1;
  } else if (props) {
    tally.props += 1;
  } else if (result.differences.length > 0) {
    tally.memo += 1;
  }
}

function formatRows(rows: string[][]): string {
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
      cells.push(cell.padEnd(widths[index] ?? 0));
    }
    lines.push(cells.join(' | ').trimEnd());
  }
  return lines.join('\n');
}

function formatTallies(title: string, tallies: Map<string, Tally>, showCapped: boolean): string {
  const header: string[] = [title, ...COLUMNS];
  if (showCapped) {
    header.push('capped');
  }
  const rows: string[][] = [header];
  const total = createTally();
  for (const [key, tally] of tallies) {
    const row = [key];
    for (const column of COLUMNS) {
      row.push(String(tally[column]));
      total[column] += tally[column];
    }
    if (showCapped) {
      row.push(String(tally.capped));
    }
    total.capped += tally.capped;
    rows.push(row);
  }
  const last = ['total'];
  for (const column of COLUMNS) {
    last.push(String(total[column]));
  }
  if (showCapped) {
    last.push(String(total.capped));
  }
  rows.push(last);
  return formatRows(rows);
}

/** Cuts both outputs to a window around their first differing character. */
function cutAroundDifference(expected: string, actual: string): [string, string] {
  let index = 0;
  while (index < expected.length && expected[index] === actual[index]) {
    index += 1;
  }
  const start = Math.max(0, index - 80);
  const prefix = start > 0 ? '...' : '';
  return [prefix + expected.slice(start, index + 120), prefix + actual.slice(start, index + 120)];
}

/**
 * Lists differences: a summary per compiler and target, then one row per mutant and
 * cell with every step, then the first step of each with both outputs.
 */
function formatDifferences(title: string, results: MutantResult[], allowance: Allowance): string {
  const rows: string[][] = [['compiler', 'target', 'file', 'operator', 'site', 'steps']];
  const details: string[] = [];
  const perCell = new Map<string, { mutants: number; steps: number }>();
  for (const result of results) {
    const { mutant } = result;
    const name = `${mutant.operator}/${mutant.variant}#${mutant.index}`;

    // Group the steps by compiler and target.
    const byCell = new Map<string, Difference[]>();
    for (const difference of result.differences) {
      if (difference.allowance !== allowance) {
        continue;
      }
      const cell = `${difference.compiler}@${difference.target}`;
      const list = byCell.get(cell) ?? [];
      list.push(difference);
      byCell.set(cell, list);
    }

    for (const [cell, list] of byCell) {
      const [compiler = '', target = ''] = cell.split('@');
      const steps: string[] = [];
      for (const difference of list) {
        steps.push(
          difference.kind === 'html' ? difference.step : `${difference.step} (${difference.kind})`,
        );
      }
      rows.push([compiler, target, result.file, name, mutant.site, steps.join(', ')]);
      const count = perCell.get(cell) ?? { mutants: 0, steps: 0 };
      count.mutants += 1;
      count.steps += list.length;
      perCell.set(cell, count);
      const first = list[0] as Difference;
      const reason = mutant.exempt === null ? '' : ` (${mutant.exempt})`;
      const [expected, actual] = cutAroundDifference(first.expected, first.actual);
      details.push(
        `${cell} ${result.file} ${name} ${first.step}${reason}\n  plain: ${expected}\n  ${compiler}: ${actual}`,
      );
    }
  }
  if (rows.length === 1) {
    return `${title}: none`;
  }
  const summary: string[][] = [['compiler@target', 'mutants', 'steps']];
  for (const [cell, count] of [...perCell].sort((a, b) => a[0].localeCompare(b[0]))) {
    summary.push([cell, String(count.mutants), String(count.steps)]);
  }
  return `${title}:\n${formatRows(summary)}\n\n${formatRows(rows)}\n\nFirst step of each:\n${details.join('\n')}`;
}

/** The text report: tallies per operator and per file, then the differences, broken and dropped mutants. */
export function formatReport(results: MutantResult[], generated: Map<string, Generated>): string {
  // Tallies per `<operator>/<variant>` and per file.
  const byOperator = new Map<string, Tally>();
  const byFile = new Map<string, Tally>();
  for (const result of results) {
    const key = `${result.mutant.operator}/${result.mutant.variant}`;
    const operatorTally = byOperator.get(key) ?? createTally();
    addResult(operatorTally, result);
    byOperator.set(key, operatorTally);
    const fileTally = byFile.get(result.file) ?? createTally();
    addResult(fileTally, result);
    byFile.set(result.file, fileTally);
  }
  for (const [file, info] of generated) {
    for (const [key, count] of info.capped) {
      const tally = byOperator.get(key) ?? createTally();
      tally.capped += count;
      byOperator.set(key, tally);
    }
    if (!byFile.has(file)) {
      byFile.set(file, createTally());
    }
  }
  const sortedOperators = new Map([...byOperator].sort((a, b) => a[0].localeCompare(b[0])));

  const sections: string[] = [
    formatTallies('operator', sortedOperators, true),
    formatTallies('file', byFile, false),
    formatDifferences('Differences (fail the check)', results, null),
    formatDifferences('Allowed differences (stale values behind memo)', results, 'memo'),
    formatDifferences(
      'Allowed differences (props mutation: the component changes a value it got through props)',
      results,
      'props',
    ),
  ];

  const brokenLines: string[] = [];
  const hungLines: string[] = [];
  for (const result of results) {
    const { mutant } = result;
    const name = `${result.file} ${mutant.operator}/${mutant.variant}#${mutant.index} ${mutant.site}`;
    if (result.broken !== null) {
      brokenLines.push(`${name}: ${result.broken}`);
    }
    if (result.hung !== null) {
      hungLines.push(`${name}: ${result.hung}`);
    }
  }
  if (brokenLines.length > 0) {
    sections.push(
      `Broken mutants (plain failed to load, or a compiled cell crashed or hung; fail the check):\n${brokenLines.join('\n')}`,
    );
  }
  if (hungLines.length > 0) {
    sections.push(
      `Hung mutants (the uncompiled run never finished, so nothing to compare; do not fail the check):\n${hungLines.join('\n')}`,
    );
  }

  const droppedLines: string[] = [];
  for (const [file, info] of generated) {
    for (const item of info.dropped) {
      droppedLines.push(`${file} ${item.operator}/${item.variant} ${item.site}: ${item.reason}`);
    }
  }
  if (droppedLines.length > 0) {
    sections.push(`Dropped candidates:\n${droppedLines.join('\n')}`);
  }
  return sections.join('\n\n');
}
