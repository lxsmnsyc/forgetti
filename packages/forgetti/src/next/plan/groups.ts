import type { CachePlan, OwnershipResult, ScopeResult } from '../ir';

/** Stub: returns the plan unchanged. The groups planner node replaces the body. */
export function runGroups(
  _scope: ScopeResult,
  _ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  return plan;
}
