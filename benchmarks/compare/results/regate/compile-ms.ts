// Sums the per-file compile medians (`ms` column of the compile table) per compiler and target.
// Usage: node benchmarks/compare/results/regate/compile-ms.ts <table.txt>
import fs from 'node:fs';

function main(): number {
  const [input] = process.argv.slice(2);
  if (input === undefined) {
    console.error('Usage: node compile-ms.ts <table.txt>');
    return 2;
  }

  // Compile rows have 9 cells: case, compiler, target, raw, gzip, slots, ms, compiled, bailouts.
  const totals = new Map<string, number>();
  for (const line of fs.readFileSync(input, 'utf8').split('\n')) {
    const cells = line.split('|');
    if (cells.length !== 9) {
      continue;
    }
    const compiler = (cells[1] ?? '').trim();
    const target = (cells[2] ?? '').trim();
    const ms = Number.parseFloat(cells[6] ?? '');
    if (compiler === 'plain' || Number.isNaN(ms)) {
      continue;
    }
    const key = `${compiler}@${target}`;
    totals.set(key, (totals.get(key) ?? 0) + ms);
  }

  for (const [key, total] of totals) {
    console.log(`${key} ${total.toFixed(1)} ms`);
  }
  return 0;
}

process.exitCode = main();
