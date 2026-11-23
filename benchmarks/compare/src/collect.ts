import { readSet } from './corpus.ts';
import { compileCase, type NextCompile } from './compilers.ts';
import { createLoader, loadNextCompile } from './loader.ts';
import { runScenarios, writeModule } from './run.ts';
import {
  COMPILERS,
  getCellKey,
  TARGETS,
  type CaseResult,
  type Cell,
  type CompileInfo,
  type Compiler,
  type CorpusCase,
  type Target,
} from './types.ts';

export interface CollectOptions {
  sets: string[];
  /** Restricts the compilers. The default is all four. */
  compilers?: Compiler[];
  /** Restricts the targets. The default is both. */
  targets?: Target[];
  /** Restricts the cases by name. */
  only?: string[];
  /** Cases read from outside the corpus, such as a test fixture. They run after the sets. */
  extraCases?: CorpusCase[];
}

/** React Compiler only supports React. Every compiler is skipped for a target the case does not list. */
function isSupported(compiler: Compiler, target: Target, testCase: CorpusCase): boolean {
  if (!testCase.meta.targets.includes(target)) {
    return false;
  }
  return !(compiler === 'react-compiler' && target === 'preact');
}

async function collectCell(
  compiler: Compiler,
  target: Target,
  testCase: CorpusCase,
  compileNext: NextCompile | null,
  loader: Awaited<ReturnType<typeof createLoader>>,
): Promise<Cell> {
  // A compiler that throws on any file is a failed cell, not a crash of the whole run.
  let compile: CompileInfo;
  try {
    compile = compileCase(compiler, testCase, target, compileNext);
  } catch (error) {
    const empty: CompileInfo = {
      code: testCase.source,
      siblings: [],
      raw: 0,
      gz: 0,
      slots: 0,
      ms: 0,
      units: 0,
      compiled: 0,
      bailouts: [],
    };
    return { compile: empty, steps: [], failure: `compile: ${String(error).slice(0, 300)}` };
  }
  try {
    const file = writeModule(compiler, target, testCase, compile);
    const steps = await runScenarios(loader, target, testCase, file);
    return { compile, steps };
  } catch (error) {
    return { compile, steps: [], failure: String(error).slice(0, 300) };
  }
}

/** Compiles and runs every case of the chosen sets with each compiler on each target. */
export async function collect(options: CollectOptions): Promise<CaseResult[]> {
  const compilers = options.compilers ?? COMPILERS;
  const targets = options.targets ?? TARGETS;
  const loader = await createLoader();
  try {
    const compileNext = compilers.includes('next')
      ? ((await loadNextCompile(loader)) as NextCompile)
      : null;

    const testCases: CorpusCase[] = [];
    for (const set of options.sets) {
      testCases.push(...readSet(set));
    }
    testCases.push(...(options.extraCases ?? []));

    const results: CaseResult[] = [];
    for (const testCase of testCases) {
      if (options.only && !options.only.includes(testCase.name)) {
        continue;
      }
      const cells = new Map<string, Cell>();
      for (const target of targets) {
        for (const compiler of compilers) {
          if (isSupported(compiler, target, testCase)) {
            cells.set(
              getCellKey(compiler, target),
              await collectCell(compiler, target, testCase, compileNext, loader),
            );
          }
        }
      }
      results.push({ set: testCase.set, name: testCase.name, cells });
    }
    return results;
  } finally {
    await loader.close();
  }
}
