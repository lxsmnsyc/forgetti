import type { CachePlan, OwnershipResult, ScopeResult } from '../ir';

/** Stub: returns the plan unchanged. The `s1-baseline` node replaces the body. */
export function runBaseline(
  _scope: ScopeResult,
  _ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  return plan;
}
