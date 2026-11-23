import fs from 'node:fs';
import path from 'node:path';
import * as babel from '@babel/core';
// @ts-expect-error: the alias has no type declarations. Babel 7 has the same API as the Babel 8 types.
import * as babel7Module from '@babel/core-7';
import reactCompiler from 'babel-plugin-react-compiler';
import forgetti from 'forgetti-0.8';
import { relinkCounter, retarget, type NextCompile } from '../src/compilers.ts';
import type { Loader } from '../src/loader.ts';
import { findDifferences } from '../src/metrics.ts';
import { runScenarios, writeModule } from '../src/run.ts';
import type { Cell, CompileInfo, Compiler, CorpusCase, StepResult, Target } from '../src/types.ts';
import type { Mutant } from './types.ts';

// React Compiler 1.0 runs under Babel 7, as in the harness.
const babel7 = babel7Module as unknown as typeof babel;

// The changing global `__mutG` and `Date.now()` show the harness's step index: the
// number of steps the cell has started, mount steps included. React may render more or
// fewer times than the uncompiled run, so a value that moved per read, or per step with
// a read, would depend on the compiler's read history and not only on what it cached.
//
// The harness clears the case counter before each step with
// `for (const k in C) delete C[k]`. A `for...in` also walks the prototype chain, so a
// proxy set as the counter's prototype sees each clear through its `ownKeys` trap.
const CLOCK_START = Date.UTC(2026, 0, 1);
const DAY = 86_400_000;

const clock = { step: 0 };
const realNow = Date.now;

/** Installs the changing global `__mutG` and the stepped `Date.now` for the whole run. */
export function installClock(): void {
  Object.defineProperty(globalThis, '__mutG', {
    configurable: true,
    get: () => clock.step,
  });
  Date.now = () => CLOCK_START + clock.step * DAY;
}

export function uninstallClock(): void {
  Date.now = realNow;
  delete (globalThis as { __mutG?: unknown }).__mutG;
}

/** Restarts the step count and counts each clear of the cell's own counter as a step. */
function resetClock(counts: Record<string, number>): void {
  clock.step = 0;
  const watcher = new Proxy(
    {},
    {
      ownKeys(target) {
        clock.step += 1;
        return Reflect.ownKeys(target);
      },
    },
  );
  Object.setPrototypeOf(counts, watcher);
}

const EMPTY_COMPILE: Omit<CompileInfo, 'code'> = {
  siblings: [],
  raw: 0,
  gz: 0,
  slots: 0,
  ms: 0,
  units: 0,
  compiled: 0,
  bailouts: [],
};

/** Runs a Babel plugin with the options `compileCase` uses. */
function runBabel(
  code: string,
  filename: string,
  plugin: babel.PluginItem,
  core: typeof babel,
): string {
  let plugins: ('jsx' | 'typescript')[] = ['jsx'];
  if (filename.endsWith('.tsx')) {
    plugins = ['jsx', 'typescript'];
  } else if (filename.endsWith('.ts')) {
    plugins = ['typescript'];
  }
  const result = core.transformSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    plugins: [plugin],
    parserOpts: { plugins },
    retainLines: false,
  });
  if (result?.code == null) {
    throw new Error(`Babel produced no code for ${filename}`);
  }
  return result.code;
}

/** Compiles one file with the compiler and options `compileCase` uses, once. */
function compileFile(
  compiler: Compiler,
  source: string,
  filename: string,
  target: Target,
  compileNext: NextCompile | null,
): string {
  const prepared = retarget(relinkCounter(source), target);
  if (compiler === 'plain') {
    return prepared;
  }
  if (compiler === 'next') {
    if (compileNext === null) {
      throw new Error('The new compiler is not loaded');
    }
    return compileNext(prepared, { preset: target, filename }).code;
  }
  if (compiler === 'forgetti-0.8') {
    return runBabel(prepared, filename, [forgetti, { preset: target }], babel);
  }
  const logger = { logEvent() {} };
  return runBabel(
    prepared,
    filename,
    [reactCompiler, { logger, panicThreshold: 'none', compilationMode: 'infer' }],
    babel7,
  );
}

/**
 * Compiles a case once, with the same compiler calls as `compileCase` minus its 20
 * timing runs, which the mutants do not need.
 */
function compileOnce(
  compiler: Compiler,
  testCase: CorpusCase,
  target: Target,
  compileNext: NextCompile | null,
): CompileInfo {
  const siblings = [];
  for (const sibling of testCase.siblings) {
    siblings.push({
      file: sibling.file,
      code: compileFile(compiler, sibling.source, sibling.file, target, compileNext),
    });
  }
  const code = compileFile(compiler, testCase.source, testCase.inputFile, target, compileNext);
  return { ...EMPTY_COMPILE, code, siblings };
}

/** Compiles, writes and runs one cell, as `collect` does, with the clock reset first. */
export async function runCell(
  loader: Loader,
  compiler: Compiler,
  target: Target,
  testCase: CorpusCase,
  compileNext: NextCompile | null,
): Promise<Cell> {
  let compile: CompileInfo;
  try {
    compile = compileOnce(compiler, testCase, target, compileNext);
  } catch (error) {
    return {
      compile: { ...EMPTY_COMPILE, code: testCase.source },
      steps: [],
      failure: `compile: ${String(error).slice(0, 300)}`,
    };
  }
  try {
    const file = writeModule(compiler, target, testCase, compile);
    // The counter module is the one `runScenarios` loads: same path, same instance.
    const counter = (await loader.load(path.join(path.dirname(file), 'counter.js'))) as {
      C: Record<string, number>;
    };
    resetClock(counter.C);
    const steps = await runScenarios(loader, target, testCase, file);
    return { compile, steps };
  } catch (error) {
    return { compile, steps: [], failure: String(error).slice(0, 300) };
  }
}

/**
 * A difference that is reported but does not fail the check: `memo` when it sits
 * inside output React may skip behind `memo`, `props` when the mutant changes a value
 * the component got through its props (out of contract: it breaks the Rules of React).
 */
export type Allowance = 'memo' | 'props' | null;

export interface Difference {
  compiler: Compiler;
  target: Target;
  /** `scenario/step`, or `load` when the cell failed. */
  step: string;
  /** `html` when only the markup differs; `error` or `load` otherwise. */
  kind: 'html' | 'error' | 'load';
  /** Why the difference does not fail the check, or null when it does. */
  allowance: Allowance;
  expected: string;
  actual: string;
}

export interface MutantResult {
  file: string;
  mutant: Mutant;
  /** Plain output equals the original's on every target: the hazard never showed. */
  inert: boolean;
  /**
   * The plain mutant failed to load, or a compiled cell never finished: an operator bug
   * or a hang in the compiler under test. Fails the run.
   */
  broken: string | null;
  /**
   * The plain run of the mutant never finished (a render loop in the uncompiled code).
   * The hazard cannot be judged; the mutant is reported and does not fail the run.
   */
  hung: string | null;
  differences: Difference[];
  /** Wall time of the mutant's runs. */
  ms: number;
}

// A `<mut-memo data-s="n">` element with no mark inside it: group 1 is the stamp, group
// 2 the contents. A compared mark becomes the placeholder, which this does not match.
const INNER_MEMO_MARK = /<mut-memo data-s="(\d+)">((?:(?!<mut-memo )[\s\S])*?)<\/mut-memo>/g;
const MEMO_PLACEHOLDER = '<mut-skip></mut-skip>';
const MEMO_TAG = /<mut-memo data-s="\d+">|<\/mut-memo>/g;
const MEMO_STAMP = /<mut-memo data-s="\d+">/g;

/**
 * True when two outputs of one step differ only inside `memo` marks that were skipped
 * in the compiled run. Marks are compared innermost first and pairwise, in order. A pair
 * may differ only when the compiled mark's stamp is older than `step`, the current
 * step: the `memo` body did not render in this step. The rest must match exactly.
 */
export function matchesBehindMemo(expected: string, actual: string, step: number): boolean {
  let left = expected;
  let right = actual;
  for (;;) {
    const leftMarks = [...left.matchAll(INNER_MEMO_MARK)];
    const rightMarks = [...right.matchAll(INNER_MEMO_MARK)];
    if (leftMarks.length !== rightMarks.length) {
      return false;
    }
    if (leftMarks.length === 0) {
      return left === right;
    }
    for (const [index, mark] of rightMarks.entries()) {
      const plainContent = leftMarks[index]?.[2];
      if (mark[2] !== plainContent && Number(mark[1]) >= step) {
        return false;
      }
    }
    // The compared marks become placeholders, so the next pass sees their parents.
    left = left.replace(INNER_MEMO_MARK, MEMO_PLACEHOLDER);
    right = right.replace(INNER_MEMO_MARK, MEMO_PLACEHOLDER);
  }
}

/** Drops the stamps of the `memo` marks and keeps the marks. */
function removeStamps(html: string): string {
  return html.replace(MEMO_STAMP, '<mut-memo>');
}

/** Removes the `memo` mark tags and keeps their contents, to compare with the original. */
export function unwrapMemoMarks(html: string): string {
  return html.replace(MEMO_TAG, '');
}

/** Every step where a cell differs from plain, with the HTML or error of both. */
function compareCells(
  compiler: Compiler,
  target: Target,
  cell: Cell,
  plain: Cell,
  mutant: Mutant,
): Difference[] {
  if (cell.failure !== undefined) {
    return [
      {
        compiler,
        target,
        step: 'load',
        kind: 'load',
        allowance: null,
        expected: '',
        actual: cell.failure,
      },
    ];
  }
  // The n-th result of a cell comes from its n-th step, so its clock step is n (from 1).
  const byKey = new Map<string, StepResult>();
  const stepIndex = new Map<string, number>();
  for (const [index, step] of cell.steps.entries()) {
    byKey.set(`${step.scenario}/${step.step}`, step);
    stepIndex.set(`${step.scenario}/${step.step}`, index + 1);
  }
  const differences: Difference[] = [];
  for (const expected of plain.steps) {
    const key = `${expected.scenario}/${expected.step}`;
    const actual = byKey.get(key);
    // Stamps alone may differ: a compiled `memo` body that skips a step it may skip.
    if (
      actual !== undefined &&
      actual.error === expected.error &&
      removeStamps(actual.html) === removeStamps(expected.html)
    ) {
      continue;
    }
    const kind = actual !== undefined && actual.error === expected.error ? 'html' : 'error';

    // Props mutation is out of contract: any step difference is allowed, errors included
    // (React freezes some props objects, so a second write can throw), and so are the
    // steps an error skipped. Behind `memo`, only HTML inside marks the compiled run
    // skipped may differ.
    let allowance: Allowance = null;
    if (mutant.propsMutation) {
      allowance = 'props';
    } else if (
      mutant.exempt !== null &&
      kind === 'html' &&
      actual !== undefined &&
      matchesBehindMemo(expected.html, actual.html, stepIndex.get(key) ?? 0)
    ) {
      allowance = 'memo';
    }
    differences.push({
      compiler,
      target,
      step: key,
      kind,
      allowance,
      expected: expected.error ?? expected.html,
      actual: actual === undefined ? 'missing' : (actual.error ?? actual.html),
    });
  }
  return differences;
}

/** The case a mutant runs as. Its own name gives it its own output folder and module ids. */
export function createMutantCase(testCase: CorpusCase, mutant: Mutant): CorpusCase {
  return {
    ...testCase,
    name: `${testCase.name}--${mutant.operator}-${mutant.variant}-${mutant.index}`,
    source: mutant.source,
  };
}

/** Writes a mutant's source under the output folder, for reading a difference. */
export function saveMutant(outDir: string, testCase: CorpusCase, mutant: Mutant): string {
  const dir = path.join(outDir, testCase.set, testCase.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${mutant.operator}.${mutant.variant}.${mutant.index}${path.extname(testCase.inputFile)}`,
  );
  fs.writeFileSync(file, mutant.source);
  return file;
}

/**
 * Runs one mutant: plain on each target first, compared with the original's plain
 * output. An inert mutant stops there. A live one runs every compiler under test and
 * is compared with its own plain output.
 */
export async function runMutant(
  loader: Loader,
  testCase: CorpusCase,
  mutant: Mutant,
  originals: Map<Target, Cell>,
  compilers: Compiler[],
  compileNext: NextCompile | null,
  onCell: (cell: string) => void = () => {},
): Promise<MutantResult> {
  const mutantCase = createMutantCase(testCase, mutant);
  const result: MutantResult = {
    file: `${testCase.set}/${testCase.name}`,
    mutant,
    inert: true,
    broken: null,
    hung: null,
    differences: [],
    ms: 0,
  };
  const started = performance.now();

  // Plain on every target decides whether the hazard is visible.
  const plains = new Map<Target, Cell>();
  for (const target of testCase.meta.targets) {
    onCell(`plain@${target}`);
    const plain = await runCell(loader, 'plain', target, mutantCase, compileNext);
    plains.set(target, plain);
    if (plain.failure !== undefined) {
      result.broken = `${target}: ${plain.failure}`;
      return result;
    }
    // The `memo` marks alone do not make a mutant live: compare without their tags.
    const original = originals.get(target);
    const unmarked: Cell = { ...plain, steps: [] };
    for (const step of plain.steps) {
      unmarked.steps.push({ ...step, html: unwrapMemoMarks(step.html) });
    }
    if (original === undefined || findDifferences(unmarked, original).length > 0) {
      result.inert = false;
    }
  }
  if (result.inert) {
    return result;
  }

  // Each compiler under test must match the mutant's plain output.
  for (const target of testCase.meta.targets) {
    const plain = plains.get(target) as Cell;
    for (const compiler of compilers) {
      if (compiler === 'react-compiler' && target === 'preact') {
        continue;
      }
      onCell(`${compiler}@${target}`);
      const cell = await runCell(loader, compiler, target, mutantCase, compileNext);
      result.differences.push(...compareCells(compiler, target, cell, plain, mutant));
    }
  }
  result.ms = performance.now() - started;
  return result;
}
