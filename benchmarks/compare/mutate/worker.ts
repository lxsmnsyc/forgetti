import path from 'node:path';
import type { NextCompile } from '../src/compilers.ts';
import { readCase } from '../src/corpus.ts';
import { CORPUS_DIR, createLoader, loadNextCompile, type Loader } from '../src/loader.ts';
import type { Cell, Compiler, CorpusCase, Target } from '../src/types.ts';
import { installClock, runCell, runMutant, type MutantResult } from './run.ts';
import type { Mutant } from './types.ts';

/** A message from the parent: run one mutant of one case. */
export interface Task {
  id: number;
  set: string;
  name: string;
  mutant: Mutant;
  compilers: Compiler[];
}

/** A reply: the cell the mutant is starting, or its result. */
export type Reply =
  | { id: number; kind: 'cell'; cell: string }
  | { id: number; kind: 'result'; result: MutantResult };

// Mutants per Vite server. One server for many mutants slowed down as its module graph
// grew (54 s against 12 s for `heldout2/list_group`).
const BATCH = 8;

interface Server {
  loader: Loader;
  compileNext: NextCompile | null;
  used: number;
}

let server: Server | null = null;
const cases = new Map<string, { testCase: CorpusCase; originals: Map<Target, Cell> }>();

/** The Vite server for the next mutant, replaced every `BATCH` mutants. */
async function getServer(compilers: Compiler[]): Promise<Server> {
  if (server !== null && server.used >= BATCH) {
    await server.loader.close();
    server = null;
  }
  if (server === null) {
    const loader = await createLoader();
    const compileNext = compilers.includes('next')
      ? ((await loadNextCompile(loader)) as NextCompile)
      : null;
    server = { loader, compileNext, used: 0 };
  }
  server.used += 1;
  return server;
}

/** Reads a case once per worker and runs its original's plain output once per target. */
async function getCase(
  task: Task,
  current: Server,
): Promise<{ testCase: CorpusCase; originals: Map<Target, Cell> }> {
  const key = `${task.set}/${task.name}`;
  let entry = cases.get(key);
  if (entry === undefined) {
    const testCase = readCase(task.set, task.name, path.join(CORPUS_DIR, task.set, task.name));
    const originals = new Map<Target, Cell>();
    for (const target of testCase.meta.targets) {
      originals.set(
        target,
        await runCell(current.loader, 'plain', target, testCase, current.compileNext),
      );
    }
    entry = { testCase, originals };
    cases.set(key, entry);
  }
  return entry;
}

async function runTask(task: Task): Promise<void> {
  const current = await getServer(task.compilers);
  const { testCase, originals } = await getCase(task, current);
  // The parent hears which cell runs, so a hang can be told apart: plain or compiled.
  const result = await runMutant(
    current.loader,
    testCase,
    task.mutant,
    originals,
    task.compilers,
    current.compileNext,
    (cell) => {
      const reply: Reply = { id: task.id, kind: 'cell', cell };
      process.send?.(reply);
    },
  );
  const reply: Reply = { id: task.id, kind: 'result', result };
  process.send?.(reply);
}

// Tasks arrive one at a time; the parent sends the next after each reply.
installClock();
process.on('message', (task: Task) => {
  void runTask(task);
});
