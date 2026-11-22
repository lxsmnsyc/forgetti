import { parseSync } from 'oxc-parser';
import type { AstNode } from '../emit/ast';
import { isNode } from '../emit/ast';
import type { CompileOptions } from '../index';
import type { Binding, Reference, Scope, ScopeResult, Unit } from '../ir';
import { resolvePreset } from './presets';
import type { ScopeTable } from './scope';
import { buildScopes } from './scope';
import { findUnits } from './units';

export { PRESETS, resolvePreset } from './presets';

/** Phase 1 output. `globals` lists the references that resolve to no binding. */
export interface ParseResult extends ScopeResult {
  globals: Reference[];
}

/** True when scope `id` is `ancestor` or lies inside it. */
function isInside(scopes: Scope[], id: number, ancestor: number): boolean {
  for (let current: number | null = id; current !== null; current = scopes[current].parent) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * Sets `Reference.closure` to the outermost function between the reference and its unit.
 * That function is the closure value the unit creates during render.
 */
function markClosures(table: ScopeTable): void {
  const references: Reference[] = [...table.globals];
  for (const binding of table.bindings) {
    references.push(...binding.references);
  }
  for (const reference of references) {
    let closure: number | undefined;
    for (
      let current: number | null = reference.scope;
      current !== null;
      current = table.scopes[current].parent
    ) {
      const { kind } = table.scopes[current];
      if (kind === 'unit') {
        if (closure !== undefined) {
          reference.closure = closure;
        }
        break;
      }
      if (kind === 'function') {
        closure = current;
      }
    }
  }
}

/**
 * Renumbers bindings: each unit's parameters, then the rest of its bindings in source order,
 * unit by unit, then every other binding in source order. Fixture ids follow this order.
 */
function renumberBindings(table: ScopeTable, units: Unit[]): Binding[] {
  const bySource = [...table.bindings].sort((a, b) => a.declaration.start - b.declaration.start);
  const ordered: Binding[] = [];
  const placed = new Set<Binding>();

  for (const unit of units) {
    const unitScope = table.functionScopes.get(unit.node);
    if (unitScope === undefined) {
      continue;
    }
    const params: Binding[] = [];
    const locals: Binding[] = [];
    for (const binding of bySource) {
      if (placed.has(binding) || !isInside(table.scopes, binding.scope, unitScope)) {
        continue;
      }
      if (binding.scope === unitScope && binding.kind === 'param') {
        params.push(binding);
      } else {
        locals.push(binding);
      }
    }
    for (const binding of [...params, ...locals]) {
      placed.add(binding);
      ordered.push(binding);
    }
  }
  for (const binding of bySource) {
    if (!placed.has(binding)) {
      ordered.push(binding);
    }
  }

  for (const [index, binding] of ordered.entries()) {
    binding.id = index;
  }
  return ordered;
}

/** Throws an `Error` that names the first parse error and its UTF-16 offset, like `compile()`. */
function assertNoErrors(errors: ReturnType<typeof parseSync>['errors']): void {
  for (const error of errors) {
    if (error.severity.toString() !== 'Error') {
      continue;
    }
    const start = error.labels[0]?.start ?? 0;
    throw new Error(`${error.message} (at ${start})`);
  }
}

/**
 * Phase 1: parses a module, finds its components and hooks, and builds its bindings.
 * `bindings[id]` is the binding with that id. Scope 0 is the module.
 */
export function parseAndScope(
  code: string,
  options: Pick<CompileOptions, 'filename' | 'preset'>,
): ParseResult {
  // Parse, and throw on the first error the same way `compile()` does.
  const parsed = parseSync(options.filename, code, { preserveParens: false });
  assertNoErrors(parsed.errors);
  const { program } = parsed;
  const root: unknown = program;
  if (!isNode(root)) {
    throw new Error('parse: the program is not an ESTree node');
  }
  const programNode: AstNode = root;

  // Bindings come first: HOC detection needs to know what `memo` resolves to.
  const table = buildScopes(programNode);
  const units = findUnits({
    code,
    program: programNode,
    comments: parsed.comments,
    preset: resolvePreset(options.preset),
    bindingOf: table.bindingOf,
  });

  // Each unit's function scope becomes a unit scope, then closures and ids follow from it.
  for (const unit of units) {
    const scope = table.functionScopes.get(unit.node);
    if (scope !== undefined) {
      table.scopes[scope].kind = 'unit';
    }
  }
  markClosures(table);
  const bindings = renumberBindings(table, units);

  return {
    program,
    units,
    bindings,
    scopes: table.scopes,
    globals: table.globals,
    bindingOf: (node) => table.bindingOf.get(node),
  };
}
