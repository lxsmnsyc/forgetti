// Timing script for the final-gate compile time run. Not wired into the harness.
// Run it with perf-pass bench.py from folders named after the compilers.
import path from 'node:path';
import { compileSource, relinkCounter, type NextCompile } from '../../src/compilers.ts';
import { readSet } from '../../src/corpus.ts';
import { createLoader, loadNextCompile } from '../../src/loader.ts';
import type { Compiler } from '../../src/types.ts';

// The compiler comes from the folder name, so bench.py can run one command in three folders.
const compiler = path.basename(process.cwd()) as Compiler;
const loader = await createLoader();
const compileNext = compiler === 'next' ? ((await loadNextCompile(loader)) as NextCompile) : null;

// Sum of per-file medians (20 timed compiles each) over every case, React target.
let total = 0;
for (const set of ['base', 'tuning', 'heldout']) {
  for (const testCase of readSet(set)) {
    const source = relinkCounter(testCase.source);
    total += compileSource(compiler, source, testCase.inputFile, 'react', compileNext).ms;
  }
}
await loader.close();
console.log(`total_ms: ${total.toFixed(2)}`);
