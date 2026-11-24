import fs from 'node:fs';
import path from 'node:path';
import { readSet } from '../src/corpus.ts';
import { OUT_DIR } from '../src/loader.ts';
import type { CorpusCase } from '../src/types.ts';
import { generateMutants, type Generated } from './generate.ts';
import { OPERATORS } from './operators/index.ts';
import { readOptions, USAGE } from './options.ts';
import { runPool } from './pool.ts';
import { formatReport, isFailing } from './report.ts';
import { saveMutant, type MutantResult } from './run.ts';
import type { Task } from './worker.ts';

const MUTANT_DIR = path.join(OUT_DIR, 'mutate');

function hasFailure(result: MutantResult): boolean {
  for (const difference of result.differences) {
    if (isFailing(difference)) {
      return true;
    }
  }
  return false;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  const options = readOptions(args);
  const started = performance.now();

  // Cases of the chosen sets, and the operators asked for.
  const cases: CorpusCase[] = [];
  for (const set of options.sets) {
    for (const testCase of readSet(set)) {
      if (options.cases.length === 0 || options.cases.includes(testCase.name)) {
        cases.push(testCase);
      }
    }
  }
  const operators = [];
  for (const operator of OPERATORS) {
    if (options.operators.length === 0 || options.operators.includes(operator.name)) {
      operators.push(operator);
    }
  }

  // Every mutant, generated up front and saved for reading a difference later.
  fs.rmSync(MUTANT_DIR, { recursive: true, force: true });
  const generated = new Map<string, Generated>();
  const tasks: Task[] = [];
  for (const testCase of cases) {
    const info = generateMutants(testCase, operators, options.cap);
    generated.set(`${testCase.set}/${testCase.name}`, info);
    for (const mutant of info.mutants) {
      saveMutant(MUTANT_DIR, testCase, mutant);
      tasks.push({
        id: tasks.length,
        set: testCase.set,
        name: testCase.name,
        mutant,
        compilers: options.compilers,
      });
    }
  }

  // The workers run the mutants. Progress goes to stderr every 100 mutants.
  console.error(`${tasks.length} mutants on ${options.jobs} workers`);
  const results = await runPool(tasks, options.jobs, options.timeout * 1000, (result, done) => {
    if (done % 100 === 0 || done === tasks.length) {
      const seconds = ((performance.now() - started) / 1000).toFixed(0);
      console.error(`${done}/${tasks.length} mutants, ${seconds} s`);
    }
    const stopped = result.hung ?? result.broken;
    if (stopped !== null) {
      const { mutant } = result;
      console.error(
        `stopped: ${result.file} ${mutant.operator}/${mutant.variant}#${mutant.index}: ${stopped}`,
      );
    }
  });

  // The report goes to stdout and next to the mutant sources.
  const report = formatReport(results, generated);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const cap = Number.isFinite(options.cap) ? String(options.cap) : 'none';
  const text = `${report}\n\nCompilers: ${options.compilers.join(', ')}. Sets: ${options.sets.join(', ')}. Cap: ${cap}. Workers: ${options.jobs}. Time: ${seconds} s.\nMutant sources: ${MUTANT_DIR}`;
  fs.mkdirSync(MUTANT_DIR, { recursive: true });
  fs.writeFileSync(path.join(MUTANT_DIR, 'report.txt'), `${text}\n`);
  console.log(text);

  // A difference that is not allowed, a broken mutant or an unparsable mutant fails the check.
  let failed = false;
  for (const result of results) {
    if (hasFailure(result) || result.broken !== null) {
      failed = true;
    }
  }
  for (const info of generated.values()) {
    for (const item of info.dropped) {
      if (item.reason.startsWith('syntax')) {
        failed = true;
      }
    }
  }
  return failed ? 1 : 0;
}

process.exitCode = await main();
