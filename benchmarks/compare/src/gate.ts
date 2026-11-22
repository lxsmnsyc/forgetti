import { findDifferences, getCell, sumWork } from './metrics.ts';
import type { CaseResult, Compiler, Target } from './types.ts';

export interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

const BASELINES: Compiler[] = ['forgetti-0.8', 'react-compiler'];
const GZIP_TOTAL_LIMIT = 1.0;
const GZIP_FILE_LIMIT = 1.15;

/**
 * Checks the thresholds of `debate/debate.md` "Hypothesis" on the collected results.
 * Work and size are checked per target against every baseline that runs on it.
 * The compiled share is checked on `heldout` when it is among the sets, else on all of them.
 */
export function runGate(results: CaseResult[], sets: string[]): Check[] {
  const checks: Check[] = [];
  const targets: Target[] = ['react', 'preact'];

  // Threshold 1: 0 differences from the uncompiled output, every file and target.
  for (const target of targets) {
    const lines: string[] = [];
    let seen = false;
    for (const result of results) {
      const cell = getCell(result, 'next', target);
      const plain = getCell(result, 'plain', target);
      if (cell === undefined || plain === undefined) {
        continue;
      }
      seen = true;
      const differences = findDifferences(cell, plain);
      if (differences.length > 0) {
        lines.push(`${result.set}/${result.name}: ${differences.join(', ')}`);
      }
    }
    if (seen) {
      checks.push({
        name: `soundness on ${target}`,
        passed: lines.length === 0,
        detail: lines.length === 0 ? '0 differences' : lines.join('; '),
      });
    }
  }

  // Threshold 2: total work strictly below each baseline, no file above the better one.
  for (const target of targets) {
    // Only baselines that ran on this target count.
    const present: Compiler[] = [];
    for (const compiler of BASELINES) {
      for (const result of results) {
        if (getCell(result, compiler, target) !== undefined) {
          present.push(compiler);
          break;
        }
      }
    }
    let nextTotal = 0;
    const baseTotals = new Map<Compiler, number>();
    const worse: string[] = [];
    let seen = false;
    for (const result of results) {
      const next = getCell(result, 'next', target);
      const plain = getCell(result, 'plain', target);
      if (next === undefined || plain === undefined) {
        continue;
      }
      seen = true;
      const nextWork = sumWork(next, plain);
      nextTotal += nextWork;
      let best = Infinity;
      for (const compiler of present) {
        const cell = getCell(result, compiler, target);
        if (cell !== undefined) {
          const work = sumWork(cell, plain);
          baseTotals.set(compiler, (baseTotals.get(compiler) ?? 0) + work);
          best = Math.min(best, work);
        }
      }
      if (nextWork > best) {
        worse.push(`${result.set}/${result.name} ${nextWork} > ${best}`);
      }
    }
    if (seen && present.length > 0) {
      const parts: string[] = [`next ${nextTotal}`];
      let below = true;
      for (const [compiler, total] of baseTotals) {
        parts.push(`${compiler} ${total}`);
        if (nextTotal >= total) {
          below = false;
        }
      }
      checks.push({
        name: `total work below each baseline on ${target}`,
        passed: below,
        detail: parts.join(', '),
      });
      checks.push({
        name: `no file above the better baseline on ${target}`,
        passed: worse.length === 0,
        detail: worse.length === 0 ? 'every file at or below' : worse.join('; '),
      });
    }
  }

  // Threshold 3: gzip against React Compiler, on React where it runs.
  {
    let nextTotal = 0;
    let rcTotal = 0;
    const large: string[] = [];
    for (const result of results) {
      const next = getCell(result, 'next', 'react');
      const rc = getCell(result, 'react-compiler', 'react');
      if (next === undefined || rc === undefined) {
        continue;
      }
      nextTotal += next.compile.gz;
      rcTotal += rc.compile.gz;
      if (next.compile.gz > rc.compile.gz * GZIP_FILE_LIMIT) {
        large.push(
          `${result.set}/${result.name} ${next.compile.gz} > ${rc.compile.gz} x ${GZIP_FILE_LIMIT}`,
        );
      }
    }
    if (rcTotal > 0) {
      checks.push({
        name: `total gzip at most ${GZIP_TOTAL_LIMIT} x React Compiler`,
        passed: nextTotal <= rcTotal * GZIP_TOTAL_LIMIT,
        detail: `next ${nextTotal}, react-compiler ${rcTotal}, ratio ${(nextTotal / rcTotal).toFixed(3)}`,
      });
      checks.push({
        name: `no file above ${GZIP_FILE_LIMIT} x React Compiler gzip`,
        passed: large.length === 0,
        detail: large.length === 0 ? 'every file within the limit' : large.join('; '),
      });
    }
  }

  // Threshold 4: compiled share at least React Compiler's, on held-out files.
  {
    const scope = sets.includes('heldout') ? 'heldout' : 'all chosen sets';
    let nextCompiled = 0;
    let nextUnits = 0;
    let rcCompiled = 0;
    let rcUnits = 0;
    for (const result of results) {
      if (sets.includes('heldout') && result.set !== 'heldout') {
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
      checks.push({
        name: `compiled share at least React Compiler's on ${scope}`,
        passed: nextShare >= rcShare,
        detail: `next ${nextCompiled}/${nextUnits}, react-compiler ${rcCompiled}/${rcUnits}`,
      });
    }
  }

  return checks;
}

export function formatChecks(checks: Check[]): string {
  const lines: string[] = [];
  for (const check of checks) {
    lines.push(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  }
  return lines.join('\n');
}
