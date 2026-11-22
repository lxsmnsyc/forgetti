import { spawnSync } from 'node:child_process';

// Runs vitest. Vitest rejects unknown options, so `--set <name>` and `--set=<name>` are taken out here
// and passed on as COMPARE_SETS, which the held-out tests read.
function main(): number {
  const args = process.argv.slice(2);
  const rest: string[] = [];
  const sets: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--set') {
      const value = args[i + 1];
      if (value === undefined) {
        throw new Error('--set needs a value');
      }
      sets.push(...value.split(','));
      i += 1;
    } else if (arg !== undefined && arg.startsWith('--set=')) {
      sets.push(...arg.slice('--set='.length).split(','));
    } else if (arg !== undefined) {
      rest.push(arg);
    }
  }

  const result = spawnSync('vitest', ['run', ...rest], {
    stdio: 'inherit',
    env: { ...process.env, COMPARE_SETS: sets.join(',') },
  });
  return result.status ?? 1;
}

process.exitCode = main();
