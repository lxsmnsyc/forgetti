import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { MutantResult } from './run.ts';
import type { Reply, Task } from './worker.ts';

const WORKER = fileURLToPath(new URL('worker.ts', import.meta.url));

interface Slot {
  child: ChildProcess;
  task: Task | null;
  /** The cell the task is running, such as `plain@react`. */
  cell: string;
  timer: NodeJS.Timeout | null;
}

/** The result of a mutant the runner gave up on. */
function createStoppedResult(
  task: Task,
  cell: string,
  reason: string,
  timedOut: boolean,
): MutantResult {
  // A hang in plain is the mutant's own render loop. A hang elsewhere, or a crash, is
  // the compiler's or the runner's fault.
  const plain = timedOut && (cell.startsWith('plain@') || cell === '');
  return {
    file: `${task.set}/${task.name}`,
    mutant: task.mutant,
    inert: false,
    broken: plain ? null : `${cell === '' ? 'setup' : cell}: ${reason}`,
    hung: plain ? `${cell === '' ? 'setup' : cell}: ${reason}` : null,
    differences: [],
    ms: 0,
  };
}

/**
 * Runs the tasks on `jobs` worker processes, one task per worker at a time. A task that
 * takes longer than `timeoutMs` kills its worker (a render loop blocks the event loop,
 * so only the process can stop it) and a new worker takes its place. The task counts
 * as hung when plain was running, and as broken otherwise. Results come back in task order.
 */
export function runPool(
  tasks: Task[],
  jobs: number,
  timeoutMs: number,
  onResult: (result: MutantResult, done: number) => void,
): Promise<MutantResult[]> {
  const results: (MutantResult | undefined)[] = Array.from({ length: tasks.length });
  let next = 0;
  let done = 0;

  return new Promise((resolve) => {
    function finish(slot: Slot, result: MutantResult): void {
      const { task } = slot;
      if (task === null) {
        return;
      }
      if (slot.timer !== null) {
        clearTimeout(slot.timer);
      }
      slot.task = null;
      slot.timer = null;
      results[task.id] = result;
      done += 1;
      onResult(result, done);
      dispatch(slot);
    }

    function dispatch(slot: Slot): void {
      // No task left: stop this worker, and resolve once every task has a result.
      if (next >= tasks.length) {
        slot.child.kill();
        if (done === tasks.length) {
          resolve(results as MutantResult[]);
        }
        return;
      }
      const task = tasks[next] as Task;
      next += 1;
      slot.task = task;
      slot.cell = '';
      slot.timer = setTimeout(() => {
        // The worker is stuck: replace it, then record the task.
        const stuck = slot.child;
        slot.child = spawn(slot);
        stuck.kill('SIGKILL');
        finish(
          slot,
          createStoppedResult(task, slot.cell, `no result after ${timeoutMs / 1000} s`, true),
        );
      }, timeoutMs);
      slot.child.send(task);
    }

    function spawn(slot: Slot): ChildProcess {
      // Worker output is React's warnings for every mutant; the report has what matters.
      const child = fork(WORKER, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      child.on('message', (reply: Reply) => {
        if (slot.child !== child || slot.task?.id !== reply.id) {
          return;
        }
        if (reply.kind === 'cell') {
          slot.cell = reply.cell;
        } else {
          finish(slot, reply.result);
        }
      });
      child.on('exit', (code, signal) => {
        // A worker that dies with a task in flight loses that task.
        if (slot.child === child && slot.task !== null && signal !== 'SIGKILL') {
          const task = slot.task;
          const cell = slot.cell;
          slot.child = spawn(slot);
          finish(slot, createStoppedResult(task, cell, `worker exited (${code ?? signal})`, false));
        }
      });
      return child;
    }

    if (tasks.length === 0) {
      resolve([]);
      return;
    }
    for (let index = 0; index < Math.min(jobs, tasks.length); index += 1) {
      const slot: Slot = {
        child: null as unknown as ChildProcess,
        task: null,
        cell: '',
        timer: null,
      };
      slot.child = spawn(slot);
      dispatch(slot);
    }
  });
}
