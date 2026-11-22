import type { CachePlan, OwnershipResult, ScopeResult } from '../ir';

/** Stub: returns the plan unchanged. The loops planner node replaces the body. */
export function runLoops(
  _scope: ScopeResult,
  _ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  return plan;
}
