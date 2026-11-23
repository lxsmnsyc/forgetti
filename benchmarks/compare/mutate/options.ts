import { COMPILERS, type Compiler } from '../src/types.ts';
import { OPERATORS } from './operators/index.ts';

export const USAGE = `Usage: node mutate/index.ts [--set <name>]... [--compiler <name>]... [--case <name>]... [--operator <name>]... [--cap <n>] [--jobs <n>] [--timeout <s>]
Defaults: --set base,tuning,heldout,heldout2 --compiler next, every candidate (no cap), 4 workers, 30 s per mutant.
Plain always runs as the oracle.`;

export const DEFAULT_SETS = ['base', 'tuning', 'heldout', 'heldout2'];

// Four workers fit in the 3 GB the 8 GB machine has free (about 500 MB each).
const DEFAULT_JOBS = 4;

// Seconds before a mutant counts as hung. The slowest mutant took 2 s on its own.
const DEFAULT_TIMEOUT = 30;

// Sets that measure results. The mutation check never reads them.
const SEALED_SETS = new Set(['heldout3']);

export interface Options {
  sets: string[];
  /** Compilers under test. Plain is not listed: it always runs. */
  compilers: Compiler[];
  cases: string[];
  operators: string[];
  /** Mutants kept per operator variant and file. `Infinity` keeps every candidate. */
  cap: number;
  /** Worker processes. */
  jobs: number;
  /** Seconds a mutant may run before it counts as broken. */
  timeout: number;
}

function readList(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (const [index, arg] of args.entries()) {
    if (arg === flag) {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error(`${flag} needs a value`);
      }
      values.push(...value.split(','));
    }
  }
  return values;
}

/** Reads the command line. Throws on a sealed set, an unknown compiler or operator, or a bad cap. */
export function readOptions(args: string[]): Options {
  // A sealed set is refused before any file of it is read.
  const sets = readList(args, '--set');
  for (const set of sets) {
    if (SEALED_SETS.has(set)) {
      throw new Error(`The set "${set}" is sealed. The mutation check never reads it.`);
    }
  }

  const compilers: Compiler[] = [];
  for (const name of readList(args, '--compiler')) {
    if (!COMPILERS.includes(name as Compiler)) {
      throw new Error(`Unknown compiler "${name}"`);
    }
    if (name !== 'plain') {
      compilers.push(name as Compiler);
    }
  }

  const operators = readList(args, '--operator');
  for (const name of operators) {
    let known = false;
    for (const operator of OPERATORS) {
      if (operator.name === name) {
        known = true;
      }
    }
    if (!known) {
      throw new Error(`Unknown operator "${name}"`);
    }
  }

  return {
    sets: sets.length > 0 ? sets : DEFAULT_SETS,
    compilers: compilers.length > 0 ? compilers : ['next'],
    cases: readList(args, '--case'),
    operators,
    cap: readPositive(args, '--cap', Infinity),
    jobs: readPositive(args, '--jobs', DEFAULT_JOBS),
    timeout: readPositive(args, '--timeout', DEFAULT_TIMEOUT),
  };
}

function readPositive(args: string[], flag: string, fallback: number): number {
  const text = readList(args, flag)[0];
  if (text === undefined) {
    return fallback;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} needs a positive integer, got "${text}"`);
  }
  return value;
}
