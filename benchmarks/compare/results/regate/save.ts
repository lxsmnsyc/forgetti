// Runs the gate and the table on one collected result and writes both to a folder.
// The output equals `pnpm --filter compare gate` and `table` for the same sets, which call
// the same `collect`, `runGate` and report functions.
// Usage: node benchmarks/compare/results/regate/save.ts <out dir> <set>...
import fs from 'node:fs';
import path from 'node:path';
import { collect } from '../../src/collect.ts';
import { formatChecks, runGate } from '../../src/gate.ts';
import { formatCompileTable, formatDifferences, formatRuntimeTable } from '../../src/report.ts';

async function main(): Promise<number> {
  const [out, ...sets] = process.argv.slice(2);
  if (out === undefined || sets.length === 0) {
    console.error('Usage: node save.ts <out dir> <set>...');
    return 2;
  }

  // One collect serves both outputs, so the gate and the table read the same run.
  const results = await collect({ sets });
  const checks = runGate(results, sets);
  const table = [
    formatCompileTable(results),
    formatRuntimeTable(results),
    formatDifferences(results),
  ].join('\n\n');

  // Write both files, and print the gate lines.
  fs.mkdirSync(out, { recursive: true });
  const checksText = formatChecks(checks);
  fs.writeFileSync(path.join(out, 'checks.txt'), `${checksText}\n`);
  fs.writeFileSync(path.join(out, 'table.txt'), `${table}\n`);
  console.log(checksText);
  for (const check of checks) {
    if (!check.passed) {
      return 1;
    }
  }
  return 0;
}

process.exitCode = await main();
