import type { CachePlan, OwnershipResult, ScopeResult } from '../ir';

/** Stub: returns the plan unchanged. The branches planner node replaces the body. */
export function runBranches(
  _scope: ScopeResult,
  _ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  return plan;
}
