import { collect } from './collect.ts';
import { formatChecks, runGate } from './gate.ts';
import { formatCompileTable, formatDifferences, formatRuntimeTable } from './report.ts';
import { COMPILERS, type Compiler } from './types.ts';

const USAGE = `Usage: node src/cli.ts <table|gate> [--set <name>]... [--compiler <name>]... [--case <name>]...
Sets are comma separated or repeated. The default set is base.`;

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

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'table' && command !== 'gate') {
    console.error(USAGE);
    return 2;
  }

  const sets = readList(args, '--set');
  const only = readList(args, '--case');
  const compilers = readList(args, '--compiler') as Compiler[];
  for (const compiler of compilers) {
    if (!COMPILERS.includes(compiler)) {
      throw new Error(`Unknown compiler "${compiler}"`);
    }
  }
  const chosen = sets.length > 0 ? sets : ['base'];

  // The uncompiled run is always needed as the reference.
  const selected: Compiler[] = ['plain'];
  for (const compiler of compilers) {
    if (compiler !== 'plain') {
      selected.push(compiler);
    }
  }

  const results = await collect({
    sets: chosen,
    compilers: compilers.length > 0 ? selected : undefined,
    only: only.length > 0 ? only : undefined,
  });

  if (command === 'table') {
    console.log(formatCompileTable(results));
    console.log('');
    console.log(formatRuntimeTable(results));
    console.log('');
    console.log(formatDifferences(results));
    return 0;
  }

  const checks = runGate(results, chosen);
  console.log(formatChecks(checks));
  let failed = false;
  for (const check of checks) {
    if (!check.passed) {
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

process.exitCode = await main();
