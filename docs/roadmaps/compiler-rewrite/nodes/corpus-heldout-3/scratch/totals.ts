// Runs heldout3 with plain and React Compiler only, then prints failures, step errors,
// differences from plain and the work totals per case.
// Usage (from benchmarks/compare): node <this file> [case]...
import { collect } from '../../../../../../benchmarks/compare/src/collect.ts';
import { findDifferences, getCell, sumWork } from '../../../../../../benchmarks/compare/src/metrics.ts';

const only = process.argv.slice(2);
const results = await collect({
  sets: ['heldout3'],
  compilers: ['plain', 'react-compiler'],
  only: only.length > 0 ? only : undefined,
});

const totals = { plainReact: 0, plainPreact: 0, rc: 0, diffs: 0 };
for (const result of results) {
  const plainReact = getCell(result, 'plain', 'react');
  const plainPreact = getCell(result, 'plain', 'preact');
  const rc = getCell(result, 'react-compiler', 'react');
  for (const [label, cell] of [
    ['plain@react', plainReact],
    ['plain@preact', plainPreact],
    ['rc@react', rc],
  ] as const) {
    if (cell?.failure !== undefined) {
      console.log(`${result.name} ${label} FAILURE ${cell.failure}`);
    }
    for (const step of cell?.steps ?? []) {
      if (step.error !== undefined) {
        console.log(`${result.name} ${label} ${step.scenario}/${step.step} ERROR ${step.error}`);
      }
    }
  }
  if (plainReact === undefined || plainPreact === undefined || rc === undefined) {
    continue;
  }
  if (plainReact.failure !== undefined || plainPreact.failure !== undefined) {
    continue;
  }
  const differences = findDifferences(rc, plainReact);
  for (const key of differences) {
    console.log(`${result.name} rc DIFF ${key}`);
  }
  const row = {
    plainReact: sumWork(plainReact, plainReact),
    plainPreact: sumWork(plainPreact, plainPreact),
    rc: sumWork(rc, plainReact),
  };
  totals.plainReact += row.plainReact;
  totals.plainPreact += row.plainPreact;
  totals.rc += row.rc;
  totals.diffs += differences.length;
  console.log(
    `| \`${result.name}\` | ${row.plainReact} | ${row.plainPreact} | ${row.rc} | ${differences.length} | ${rc.compile.compiled}/${rc.compile.units} |`,
  );
}
console.log(
  `| Total | ${totals.plainReact} | ${totals.plainPreact} | ${totals.rc} | ${totals.diffs} | |`,
);
