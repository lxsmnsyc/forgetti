import {
  countRecomputes,
  countRenders,
  findDifferences,
  getCell,
  getStepKey,
  MOUNT,
  sumWork,
} from './metrics.ts';
import type { CaseResult, Cell, StepResult, Target } from './types.ts';

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
  /** A reported line that is not a threshold. It never fails the gate. */
  info?: boolean;
}

const GZIP_TOTAL_LIMIT = 1.0;
const GZIP_FILE_LIMIT = 1.15;
const CLEAN_SET = 'heldout2';

/** Work of a baseline after its wrong steps are charged as the uncompiled steps. */
export interface BaselineWork {
  work: number;
  /** Replaced steps, as `scenario/step (baseline count -> uncompiled count)`. */
  replaced: string[];
}

function isHeldOut(set: string): boolean {
  return set.startsWith('heldout');
}

function getLabel(result: CaseResult): string {
  return `${result.set}/${result.name}`;
}

function countWork(step: StepResult): number {
  return countRenders(step) + countRecomputes(step);
}

/**
 * Sums a baseline's work, but every update step whose output differs from the
 * uncompiled output counts the uncompiled step's work instead (amendment-1).
 * A baseline that failed to load counts as the uncompiled run.
 */
export function sumBaselineWork(cell: Cell, plain: Cell): BaselineWork {
  if (cell.failure !== undefined) {
    return { work: sumWork(plain, plain), replaced: [`load: ${cell.failure}`] };
  }

  // Index the baseline's steps so each uncompiled step finds its match.
  const byKey = new Map<string, StepResult>();
  for (const step of cell.steps) {
    byKey.set(getStepKey(step), step);
  }

  // Walk the uncompiled steps, so a step the baseline lacks is charged too.
  let work = 0;
  const replaced: string[] = [];
  for (const expected of plain.steps) {
    if (expected.step === MOUNT) {
      continue;
    }
    const key = getStepKey(expected);
    const actual = byKey.get(key);
    const wrong =
      actual === undefined || actual.html !== expected.html || actual.error !== expected.error;
    if (wrong) {
      const own = actual === undefined || actual.error !== undefined ? '-' : countWork(actual);
      replaced.push(`${key} (${own} -> ${countWork(expected)})`);
      work += countWork(expected);
    } else {
      work += countWork(actual);
    }
  }
  return { work, replaced };
}

interface Totals {
  next: number;
  baseline: number;
  above: string[];
  seen: boolean;
}

function createTotals(): Totals {
  return { next: 0, baseline: 0, above: [], seen: false };
}

function formatAbove(above: string[], baseline: string): string {
  return above.length === 0 ? `every file at or below ${baseline}` : above.join('; ');
}

/** Applies every amendment-1 threshold to one group of results. */
function checkScope(results: CaseResult[], scope: string): Check[] {
  const checks: Check[] = [];
  const targets: Target[] = ['react', 'preact'];

  // Rule 1: 0 differences from the uncompiled output, every file and target.
  for (const target of targets) {
    const lines: string[] = [];
    let seen = false;
    for (const result of results) {
      const next = getCell(result, 'next', target);
      const plain = getCell(result, 'plain', target);
      if (next === undefined || plain === undefined) {
        continue;
      }
      seen = true;
      const differences = findDifferences(next, plain);
      if (differences.length > 0) {
        lines.push(`${getLabel(result)}: ${differences.join(', ')}`);
      }
    }
    if (seen) {
      checks.push({
        name: `soundness on ${target} (${scope})`,
        passed: lines.length === 0,
        detail: lines.length === 0 ? '0 differences' : lines.join('; '),
      });
    }
  }

  // Rule 2: React work against React Compiler, with its wrong steps replaced.
  const react = createTotals();
  for (const result of results) {
    const next = getCell(result, 'next', 'react');
    const plain = getCell(result, 'plain', 'react');
    const rc = getCell(result, 'react-compiler', 'react');
    if (next === undefined || plain === undefined || rc === undefined) {
      continue;
    }
    react.seen = true;
    const nextWork = sumWork(next, plain);
    const rcWork = sumBaselineWork(rc, plain).work;
    react.next += nextWork;
    react.baseline += rcWork;
    if (nextWork > rcWork) {
      react.above.push(`${getLabel(result)} ${nextWork} > ${rcWork}`);
    }
  }
  if (react.seen) {
    checks.push({
      name: `total work below React Compiler on react (${scope})`,
      passed: react.next < react.baseline,
      detail: `next ${react.next}, react-compiler (adjusted) ${react.baseline}`,
    });
    checks.push({
      name: `no file above React Compiler on react (${scope})`,
      passed: react.above.length === 0,
      detail: formatAbove(react.above, 'react-compiler'),
    });
  }

  // Rule 3: Preact work against the uncompiled output.
  const preact = createTotals();
  for (const result of results) {
    const next = getCell(result, 'next', 'preact');
    const plain = getCell(result, 'plain', 'preact');
    if (next === undefined || plain === undefined) {
      continue;
    }
    preact.seen = true;
    const nextWork = sumWork(next, plain);
    const plainWork = sumWork(plain, plain);
    preact.next += nextWork;
    preact.baseline += plainWork;
    if (nextWork > plainWork) {
      preact.above.push(`${getLabel(result)} ${nextWork} > ${plainWork}`);
    }
  }
  if (preact.seen) {
    checks.push({
      name: `total work below uncompiled on preact (${scope})`,
      passed: preact.next < preact.baseline,
      detail: `next ${preact.next}, plain ${preact.baseline}`,
    });
    checks.push({
      name: `no file above uncompiled on preact (${scope})`,
      passed: preact.above.length === 0,
      detail: formatAbove(preact.above, 'plain'),
    });
  }

  // Rule 4: gzip against React Compiler, on React where it runs.
  let nextGz = 0;
  let rcGz = 0;
  const large: string[] = [];
  for (const result of results) {
    const next = getCell(result, 'next', 'react');
    const rc = getCell(result, 'react-compiler', 'react');
    if (next === undefined || rc === undefined) {
      continue;
    }
    nextGz += next.compile.gz;
    rcGz += rc.compile.gz;
    if (next.compile.gz > rc.compile.gz * GZIP_FILE_LIMIT) {
      const ratio = (next.compile.gz / rc.compile.gz).toFixed(3);
      large.push(
        `${getLabel(result)} ${next.compile.gz} > ${rc.compile.gz} x ${GZIP_FILE_LIMIT} (${ratio})`,
      );
    }
  }
  if (rcGz > 0) {
    checks.push({
      name: `total gzip at most ${GZIP_TOTAL_LIMIT} x React Compiler (${scope})`,
      passed: nextGz <= rcGz * GZIP_TOTAL_LIMIT,
      detail: `next ${nextGz}, react-compiler ${rcGz}, ratio ${(nextGz / rcGz).toFixed(3)}`,
    });
    checks.push({
      name: `no file above ${GZIP_FILE_LIMIT} x React Compiler gzip (${scope})`,
      passed: large.length === 0,
      detail: large.length === 0 ? 'every file within the limit' : large.join('; '),
    });
  }

  // Rule 5: compiled share on the held-out files, or on every file when none is held out.
  let hasHeldOut = false;
  for (const result of results) {
    if (isHeldOut(result.set)) {
      hasHeldOut = true;
      break;
    }
  }
  let nextCompiled = 0;
  let nextUnits = 0;
  let rcCompiled = 0;
  let rcUnits = 0;
  for (const result of results) {
    if (hasHeldOut && !isHeldOut(result.set)) {
      continue;
    }
    const next = getCell(result, 'next', 'react');
    const rc = getCell(result, 'react-compiler', 'react');
    if (next === undefined || rc === undefined) {
      continue;
    }
    nextCompiled += next.compile.compiled;
    nextUnits += next.compile.units;
    rcCompiled += rc.compile.compiled;
    rcUnits += rc.compile.units;
  }
  if (rcUnits > 0) {
    const nextShare = nextUnits === 0 ? 0 : nextCompiled / nextUnits;
    const rcShare = rcCompiled / rcUnits;
    const files = hasHeldOut ? 'held-out files' : 'all files';
    checks.push({
      name: `compiled share at least React Compiler's on ${files} (${scope})`,
      passed: nextShare >= rcShare,
      detail: `next ${nextCompiled}/${nextUnits} (${nextShare.toFixed(3)}), react-compiler ${rcCompiled}/${rcUnits} (${rcShare.toFixed(3)})`,
    });
  }

  return checks;
}

/** Lists React Compiler's wrong steps, whose counts the work rules replace. */
function reportReplacedSteps(results: CaseResult[]): Check {
  const lines: string[] = [];
  for (const result of results) {
    const plain = getCell(result, 'plain', 'react');
    const rc = getCell(result, 'react-compiler', 'react');
    if (plain === undefined || rc === undefined) {
      continue;
    }
    const { replaced } = sumBaselineWork(rc, plain);
    if (replaced.length > 0) {
      lines.push(`${getLabel(result)}: ${replaced.join(', ')}`);
    }
  }
  return {
    name: 'react-compiler steps replaced by uncompiled counts',
    passed: true,
    info: true,
    detail: lines.length === 0 ? 'none' : lines.join('; '),
  };
}

/** Reports forgetti 0.8: totals, wrong steps, and files where it is sound and below next. */
function reportForgetti(results: CaseResult[], target: Target): Check[] {
  let f08Total = 0;
  let nextTotal = 0;
  let seen = false;
  const wrong: string[] = [];
  const lower: string[] = [];
  for (const result of results) {
    const f08 = getCell(result, 'forgetti-0.8', target);
    const next = getCell(result, 'next', target);
    const plain = getCell(result, 'plain', target);
    if (f08 === undefined || next === undefined || plain === undefined) {
      continue;
    }
    seen = true;

    // Its raw count is reported, wrong steps included, so the total matches the table.
    const f08Work = sumWork(f08, plain);
    const nextWork = sumWork(next, plain);
    f08Total += f08Work;
    nextTotal += nextWork;
    const differences = findDifferences(f08, plain);
    if (differences.length > 0) {
      wrong.push(`${getLabel(result)}: ${differences.join(', ')}`);
    } else if (f08Work < nextWork) {
      lower.push(`${getLabel(result)} next ${nextWork} > forgetti-0.8 ${f08Work}`);
    }
  }
  if (!seen) {
    return [];
  }
  return [
    {
      name: `forgetti-0.8 total work on ${target}`,
      passed: true,
      info: true,
      detail: `forgetti-0.8 ${f08Total} (wrong steps included), next ${nextTotal}`,
    },
    {
      name: `forgetti-0.8 wrong steps on ${target}`,
      passed: true,
      info: true,
      detail: wrong.length === 0 ? 'none' : wrong.join('; '),
    },
    {
      name: `forgetti-0.8 sound and below next on ${target}`,
      passed: true,
      info: true,
      detail: lower.length === 0 ? 'none' : lower.join('; '),
    },
  ];
}

function formatCellWork(cell: Cell | undefined, plain: Cell): string {
  if (cell === undefined) {
    return '-';
  }
  const differences = findDifferences(cell, plain).length;
  const work = sumWork(cell, plain);
  return differences === 0 ? String(work) : `${work} (${differences} wrong)`;
}

/** One line per file with every number the report table needs. */
function reportFile(result: CaseResult): Check {
  const parts: string[] = [];

  // React: next, React Compiler adjusted and raw, uncompiled, forgetti 0.8.
  const plainReact = getCell(result, 'plain', 'react');
  if (plainReact !== undefined) {
    const rc = getCell(result, 'react-compiler', 'react');
    const rcText =
      rc === undefined
        ? '-'
        : `${sumBaselineWork(rc, plainReact).work} (raw ${sumWork(rc, plainReact)})`;
    parts.push(
      `react next ${formatCellWork(getCell(result, 'next', 'react'), plainReact)}, react-compiler ${rcText}, plain ${sumWork(plainReact, plainReact)}, forgetti-0.8 ${formatCellWork(getCell(result, 'forgetti-0.8', 'react'), plainReact)}`,
    );
  }

  // Preact: next, uncompiled, forgetti 0.8.
  const plainPreact = getCell(result, 'plain', 'preact');
  if (plainPreact !== undefined) {
    parts.push(
      `preact next ${formatCellWork(getCell(result, 'next', 'preact'), plainPreact)}, plain ${sumWork(plainPreact, plainPreact)}, forgetti-0.8 ${formatCellWork(getCell(result, 'forgetti-0.8', 'preact'), plainPreact)}`,
    );
  }

  // Size and compiled share on React, against React Compiler.
  const next = getCell(result, 'next', 'react');
  const rc = getCell(result, 'react-compiler', 'react');
  if (next !== undefined && rc !== undefined) {
    const ratio = rc.compile.gz === 0 ? '-' : (next.compile.gz / rc.compile.gz).toFixed(3);
    parts.push(`gzip next ${next.compile.gz}, react-compiler ${rc.compile.gz}, ratio ${ratio}`);
    parts.push(
      `compiled next ${next.compile.compiled}/${next.compile.units}, react-compiler ${rc.compile.compiled}/${rc.compile.units}`,
    );
  }

  return { name: `file ${getLabel(result)}`, passed: true, info: true, detail: parts.join('; ') };
}

/**
 * Checks the thresholds of `debate/amendment-1.md` on the collected results.
 * Every rule runs on all chosen sets, then again on `heldout2` alone when it is chosen.
 * forgetti 0.8 and the per-file numbers are reported as info lines and never fail the gate.
 */
export function runGate(results: CaseResult[], sets: string[]): Check[] {
  // The thresholds, on all sets and on the clean set alone.
  const checks = checkScope(results, 'all sets');
  const clean: CaseResult[] = [];
  const others: CaseResult[] = [];
  for (const result of results) {
    if (result.set === CLEAN_SET) {
      clean.push(result);
    } else {
      others.push(result);
    }
  }
  if (sets.includes(CLEAN_SET) && clean.length > 0) {
    checks.push(...checkScope(clean, CLEAN_SET));
  }

  // Reported lines: replaced steps, forgetti 0.8, then per-file numbers with the clean set last.
  checks.push(reportReplacedSteps(results));
  for (const target of ['react', 'preact'] as const) {
    checks.push(...reportForgetti(results, target));
  }
  for (const result of others) {
    checks.push(reportFile(result));
  }
  for (const result of clean) {
    checks.push(reportFile(result));
  }
  return checks;
}

export function formatChecks(checks: Check[]): string {
  const lines: string[] = [];
  for (const check of checks) {
    const status = check.info === true ? 'INFO' : check.passed ? 'PASS' : 'FAIL';
    lines.push(`${status} ${check.name}: ${check.detail}`);
  }
  return lines.join('\n');
}
