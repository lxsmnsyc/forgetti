import type { CachePlan, OwnershipResult, ScopeResult } from '../ir';
import { runBranches } from './branches';
import { runGroups } from './groups';
import { runLoops } from './loops';

/** One planner step. It returns the plan it was given, or a new one. */
export type PlanPass = (
  scope: ScopeResult,
  ownership: OwnershipResult,
  plan: CachePlan,
) => CachePlan;

export interface NamedPass {
  name: 'groups' | 'branches' | 'loops';
  run: PlanPass;
}

/** The planner passes in running order. Each planner node owns its pass file. */
export const passes: readonly NamedPass[] = [
  { name: 'groups', run: runGroups },
  { name: 'branches', run: runBranches },
  { name: 'loops', run: runLoops },
];

/** Runs every pass over the plan of one unit, in order. */
export function runPlanPasses(
  scope: ScopeResult,
  ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  let current = plan;
  for (const pass of passes) {
    current = pass.run(scope, ownership, current);
  }
  return current;
}
