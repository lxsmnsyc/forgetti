import type { AstNode } from '../emit/ast';
import { getChild, isNode } from '../emit/ast';
import type { Eligibility, OwnershipResult, Range, ScopeResult, Unit } from '../ir';
import { GroupBuilder } from './groups';
import { UnitWalker } from './walk';

/**
 * Phase 3 output for one unit. `bailout` is set when a closure leaves render too early
 * (`escaping-closure`); the unit then gets no plan. This is phase-ir v4 as asked in
 * `contracts/phase-ir.ownership.change-request.md`, until `ir.ts` carries the field.
 */
export interface OwnershipReport extends OwnershipResult {
  bailout?: Extract<Eligibility, { ok: false }>;
}

function findUnit(scope: ScopeResult, id: number): Unit | undefined {
  for (const unit of scope.units) {
    if (unit.id === id) {
      return unit;
    }
  }
  return undefined;
}

function findUnitScope(scope: ScopeResult, node: AstNode): number | undefined {
  for (const item of scope.scopes) {
    if (item.kind === 'unit' && item.range.start === node.start && item.range.end === node.end) {
      return item.id;
    }
  }
  return undefined;
}

/** True when the binding's scope reaches the unit scope without crossing a nested function. */
function isRenderScope(scope: ScopeResult, id: number, unitScope: number): boolean {
  for (let current: number | null = id; current !== null; current = scope.scopes[current].parent) {
    if (current === unitScope) {
      return true;
    }
    if (scope.scopes[current].kind === 'function') {
      return false;
    }
  }
  return false;
}

/**
 * Phase 3: classifies the values of one unit and builds its alias groups. A group holds the
 * bindings that may point at one fresh value, its mutations, its freeze point and its
 * non-fresh inputs. Non-fresh locals that change during render are listed as opaque.
 */
export function analyzeOwnership(scope: ScopeResult, unitId: number): OwnershipReport {
  const empty: OwnershipReport = { unit: unitId, groups: [], opaque: [] };
  const unit = findUnit(scope, unitId);
  const node: unknown = unit?.node;
  if (!unit || !isNode(node)) {
    return empty;
  }
  const unitScope = findUnitScope(scope, node);
  const body = getChild(node, 'body');
  if (unitScope === undefined || !body) {
    return empty;
  }

  // Render-level locals can hold fresh values. Parameters and catch names never do.
  const locals = new Set<number>();
  const localReferences: { binding: number; range: Range; write: boolean }[] = [];
  for (const binding of scope.bindings) {
    if (binding.kind === 'param' || binding.kind === 'catch') {
      continue;
    }
    if (!isRenderScope(scope, binding.scope, unitScope)) {
      continue;
    }
    locals.add(binding.id);
    for (const reference of binding.references) {
      localReferences.push({ binding: binding.id, range: reference.range, write: reference.write });
    }
  }

  // Walk the body to a fixed point, then group what it found.
  const facts = new UnitWalker(scope, locals, localReferences).run(body);
  const built = new GroupBuilder({
    bindings: scope.bindings,
    scopes: scope.scopes,
    unitScope,
    locals,
    facts,
  }).build();

  const result: OwnershipReport = { unit: unitId, groups: built.groups, opaque: built.opaque };
  if (built.violation) {
    const { name } = scope.bindings[built.violation.binding];
    result.bailout = {
      unit: unitId,
      ok: false,
      reason: 'escaping-closure',
      range: built.violation.range,
      message: `${unit.name}: a closure that holds "${name}" escapes while "${name}" can still change`,
    };
  }
  return result;
}
