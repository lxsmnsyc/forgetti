// Census data collection. Needs the instrumented compiler (`instrument.patch` applied).
// Run with benchmarks/compare as the working directory. Output is JSON Lines.
//   node results/census/run.ts refusals <out.jsonl> <set>...
//   node results/census/run.ts steps <out.jsonl> <set>...
//   node results/census/run.ts relax <out.jsonl> <keys,comma,separated> <set>...
//   node results/census/run.ts variant <out.jsonl> <keys|-> <case dir>...
//   node results/census/run.ts dump <dir> <set>...
// `refusals` compiles every case once with next on each target and saves the census records.
// `steps` runs plain, next and React Compiler and saves every step's counts.
// `relax` turns the listed refusals off, runs plain and next, and keeps next's rows.
// `variant` runs plain and next on case folders outside the corpus, with optional relax keys.
// `dump` writes next's output on both targets, to compare builds with and without the patch.
import fs from 'node:fs';
import path from 'node:path';
import { collect } from '../../src/collect.ts';
import { relinkCounter, retarget, type NextCompile } from '../../src/compilers.ts';
import { readCase, readSet } from '../../src/corpus.ts';
import { createLoader, loadNextCompile } from '../../src/loader.ts';
import { getStepKey } from '../../src/metrics.ts';
import type { CaseResult, Compiler, Target } from '../../src/types.ts';

interface Range {
  start: number;
  end: number;
}

interface CensusRecord {
  site: string;
  code: string;
  sub?: string;
  binding?: string;
  use?: Range;
  range: Range;
  file?: string;
  unit?: string;
}

interface CensusSink {
  file?: string;
  unit?: string;
  records: CensusRecord[];
  relax: Set<string>;
}

const holder = globalThis as { __forgettiCensus?: CensusSink };

/** Writes one JSON object per line. With `nextOnly`, the plain and React Compiler rows are dropped. */
function writeLines(out: string, rows: unknown[], nextOnly = false): void {
  const lines: string[] = [];
  for (const row of rows) {
    if (nextOnly && (row as { compiler?: string }).compiler !== 'next') {
      continue;
    }
    lines.push(JSON.stringify(row));
  }
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
}

function getSnippet(source: string, range: Range | undefined): string | undefined {
  if (!range) {
    return undefined;
  }
  return source.slice(range.start, range.end).replace(/\s+/g, ' ').slice(0, 120);
}

async function collectRefusals(out: string, sets: string[]): Promise<void> {
  const loader = await createLoader();
  const rows: unknown[] = [];
  try {
    const compile = (await loadNextCompile(loader)) as NextCompile;
    for (const set of sets) {
      for (const testCase of readSet(set)) {
        const files = [{ file: testCase.inputFile, source: testCase.source }, ...testCase.siblings];
        for (const target of testCase.meta.targets) {
          for (const item of files) {
            // The source is retargeted the same way the harness does it, so ranges match.
            const source = retarget(relinkCounter(item.source), target);
            holder.__forgettiCensus = { records: [], relax: new Set() };
            compile(source, { preset: target, filename: item.file });
            const records = holder.__forgettiCensus.records;
            holder.__forgettiCensus = undefined;
            for (const record of records) {
              rows.push({
                case: `${set}/${testCase.name}`,
                target,
                file: path.basename(item.file),
                unit: record.unit,
                site: record.site,
                code: record.code,
                sub: record.sub,
                binding: record.binding,
                range: record.range,
                use: record.use,
                text: getSnippet(source, record.range),
                useText: getSnippet(source, record.use),
              });
            }
          }
        }
      }
    }
  } finally {
    holder.__forgettiCensus = undefined;
    await loader.close();
  }
  writeLines(out, rows);
  console.log(`${rows.length} records`);
}

/** Every step of every cell: counts, and whether the output equals the uncompiled output. */
function flattenSteps(results: CaseResult[]): unknown[] {
  const rows: unknown[] = [];
  for (const result of results) {
    for (const [key, cell] of result.cells) {
      const [compiler, target] = key.split('@') as [Compiler, Target];
      const plain = result.cells.get(`plain@${target}`);
      const plainByKey = new Map<string, { html: string; error?: string }>();
      for (const step of plain?.steps ?? []) {
        plainByKey.set(getStepKey(step), step);
      }
      if (cell.failure !== undefined) {
        rows.push({
          case: `${result.set}/${result.name}`,
          compiler,
          target,
          failure: cell.failure,
        });
        continue;
      }
      for (const step of cell.steps) {
        const expected = plainByKey.get(getStepKey(step));
        const same =
          expected !== undefined && expected.html === step.html && expected.error === step.error;
        rows.push({
          case: `${result.set}/${result.name}`,
          compiler,
          target,
          step: getStepKey(step),
          counts: step.counts,
          error: step.error,
          same,
        });
      }
    }
  }
  return rows;
}

async function collectSteps(
  out: string,
  sets: string[],
  compilers: Compiler[],
  relax: string[],
): Promise<void> {
  if (relax.length > 0) {
    holder.__forgettiCensus = { records: [], relax: new Set(relax) };
    // Records are not needed here. Dropping them keeps memory flat over the timing compiles.
    holder.__forgettiCensus.records.push = () => 0;
  }
  try {
    const results = await collect({ sets, compilers });
    writeLines(out, flattenSteps(results), relax.length > 0);
  } finally {
    holder.__forgettiCensus = undefined;
  }
}

/**
 * Writes next's output for every case of the sets on both targets, census off, to
 * `<dir>/<target>/<set>/<case>/<file>`. Used to check that the instrumentation changes no output.
 */
async function dumpNext(dir: string, sets: string[]): Promise<void> {
  const loader = await createLoader();
  try {
    const compile = (await loadNextCompile(loader)) as NextCompile;
    for (const target of ['react', 'preact'] as const) {
      for (const set of sets) {
        for (const testCase of readSet(set)) {
          const files = [
            { file: testCase.inputFile, source: testCase.source },
            ...testCase.siblings,
          ];
          const folder = path.join(dir, target, set, testCase.name);
          fs.mkdirSync(folder, { recursive: true });
          for (const item of files) {
            const source = retarget(relinkCounter(item.source), target);
            const result = compile(source, { preset: target, filename: item.file }) as {
              code: string;
            };
            fs.writeFileSync(path.join(folder, path.basename(item.file)), result.code);
          }
        }
      }
    }
  } finally {
    await loader.close();
  }
}

async function main(): Promise<number> {
  const [mode, out, ...rest] = process.argv.slice(2);
  if (mode === 'refusals' && out && rest.length > 0) {
    await collectRefusals(out, rest);
    return 0;
  }
  if (mode === 'steps' && out && rest.length > 0) {
    await collectSteps(out, rest, ['plain', 'next', 'react-compiler'], []);
    return 0;
  }
  if (mode === 'variant' && out && rest.length > 1) {
    const [variantKeys, ...dirs] = rest;
    const extraCases = [];
    for (const dir of dirs) {
      extraCases.push(readCase('variant', path.basename(dir), path.resolve(dir)));
    }
    const relax = variantKeys === '-' ? [] : variantKeys.split(',');
    if (relax.length > 0) {
      holder.__forgettiCensus = { records: [], relax: new Set(relax) };
      holder.__forgettiCensus.records.push = () => 0;
    }
    try {
      const results = await collect({ sets: [], compilers: ['plain', 'next'], extraCases });
      writeLines(out, flattenSteps(results));
      fs.writeFileSync(out.replace(/\.jsonl$/, '.keys'), `${variantKeys}\n`);
    } finally {
      holder.__forgettiCensus = undefined;
    }
    return 0;
  }
  if (mode === 'dump' && out && rest.length > 0) {
    await dumpNext(out, rest);
    return 0;
  }
  const [keys, ...sets] = rest;
  if (mode === 'relax' && out && keys && sets.length > 0) {
    await collectSteps(out, sets, ['plain', 'next'], keys.split(','));
    fs.writeFileSync(out.replace(/\.jsonl$/, '.keys'), `${keys}\n`);
    return 0;
  }
  console.error('Usage: node run.ts refusals|steps <out> <set>... | relax <out> <keys> <set>...');
  return 2;
}

process.exitCode = await main();
