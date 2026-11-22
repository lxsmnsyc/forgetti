import type { OwnershipResult, ScopeResult } from '../ir';

/** Stub: reports no groups. The `ownership` node replaces the body. */
export function analyzeOwnership(_scope: ScopeResult, unit: number): OwnershipResult {
  return { unit, groups: [], opaque: [] };
}
