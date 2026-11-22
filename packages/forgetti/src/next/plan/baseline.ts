import type { AstIndex, AstNode } from '../emit/ast';
import { getChild, indexProgram, isNode } from '../emit/ast';
import type { Binding, OwnershipResult, Range, Reference, ScopeResult } from '../ir';
import type { ParseResult } from '../parse';
import { PRESETS } from '../parse/presets';

export const HOOK_NAME = /^use(?:$|[A-Z0-9])/;

// Calls that change their receiver. A cached block must not contain one.
export const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
  'assign',
  'defineProperty',
  'defineProperties',
  'setPrototypeOf',
]);

// Globals whose value never changes between renders.
export const STABLE_GLOBALS = new Set([
  'Math',
  'Object',
  'Array',
  'JSON',
  'Number',
  'String',
  'Boolean',
  'Symbol',
  'BigInt',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Error',
  'Intl',
  'undefined',
  'NaN',
  'Infinity',
  'isNaN',
  'isFinite',
  'parseInt',
  'parseFloat',
  'encodeURI',
  'encodeURIComponent',
  'decodeURI',
  'decodeURIComponent',
]);

// Member names that read hidden state: `Math.random()`, `Date.now()`, `ref.current`.
export const IMPURE_MEMBERS = new Set(['random', 'now', 'current']);

const HOOK_TYPES = new Map<string, string>();
for (const preset of [PRESETS.react, PRESETS.preact]) {
  for (const hook of preset.imports.hooks) {
    if (hook.kind === 'named') {
      HOOK_TYPES.set(hook.name, hook.type);
    }
  }
}

export interface UnitRef {
  reference: Reference;
  binding: Binding;
}

export interface Context {
  scope: ScopeResult;
  index: AstIndex;
  unitRange: Range;
  /** Bindings that a group changes, or that change during render. */
  unsafe: Set<number>;
  /** Every reference in the unit that resolves to a binding, in source order. */
  refs: UnitRef[];
  /** References in the whole module that resolve to no binding. */
  globals: Reference[];
  names: Set<string>;
  /** Loop counters that keep one value for each pass of their loop body. The loops pass sets them. */
  perIteration?: Set<number>;
}

export function getRange(node: AstNode): Range {
  return { start: node.start, end: node.end };
}

export function isInside(inner: Range, outer: Range): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function getName(node: AstNode): string | undefined {
  return typeof node.name === 'string' ? node.name : undefined;
}

/** The name a member expression reads: `a.b`, `a["b"]`. Undefined for any other computed key. */
export function getMemberName(member: AstNode): string | undefined {
  const property = getChild(member, 'property');
  if (!property) {
    return undefined;
  }
  if (member.computed !== true) {
    return getName(property);
  }
  return property.type === 'Literal' && typeof property.value === 'string'
    ? property.value
    : undefined;
}

/** The called name of `f()`, `a.f()` and `a["f"]()`. Undefined when the callee has no fixed name. */
export function getCalleeName(call: AstNode): string | undefined {
  const callee = getChild(call, 'callee');
  if (callee?.type === 'Identifier') {
    return getName(callee);
  }
  return callee?.type === 'MemberExpression' ? getMemberName(callee) : undefined;
}

export function pushChildren(node: AstNode, stack: AstNode[]): void {
  for (const key of Object.keys(node)) {
    if (key === 'parent') {
      continue;
    }
    const value = node[key];
    if (isNode(value)) {
      stack.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          stack.push(item);
        }
      }
    }
  }
}

export function walkNodes(root: AstNode, visit: (node: AstNode) => boolean): boolean {
  const stack: AstNode[] = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (!visit(node)) {
      return false;
    }
    pushChildren(node, stack);
  }
  return true;
}

/** The declarator initializer of a binding, when it has one. */
export function findInitializer(ctx: Context, binding: Binding): AstNode | undefined {
  let node: AstNode | undefined;
  walkNodes(ctx.index.root, (item) => {
    if (item.type === 'VariableDeclarator' && isInside(binding.declaration, getRange(item))) {
      const id = getChild(item, 'id');
      if (id && isInside(binding.declaration, getRange(id))) {
        node = getChild(item, 'init');
        return false;
      }
    }
    return true;
  });
  return node;
}

/** True for a binding that holds a ref or an effect event, which render must not read. */
export function isHiddenState(ctx: Context, binding: Binding): boolean {
  const init = findInitializer(ctx, binding);
  if (init?.type !== 'CallExpression') {
    return false;
  }
  const type = HOOK_TYPES.get(getCalleeName(init) ?? '');
  return type === 'ref' || type === 'effect-event';
}

const PLAIN_INITIALIZERS = new Set([
  'Literal',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
]);

/** The function a module-level binding holds: a declaration, or a `const` function or arrow. */
function findFunctionNode(ctx: Context, binding: Binding): AstNode | undefined {
  if (binding.kind === 'function') {
    let node: AstNode | undefined;
    walkNodes(ctx.index.root, (item) => {
      const id = getChild(item, 'id');
      if (item.type === 'FunctionDeclaration' && id && id.start === binding.declaration.start) {
        node = item;
        return false;
      }
      return true;
    });
    return node;
  }
  const init = findInitializer(ctx, binding);
  return init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression'
    ? init
    : undefined;
}

/** True when the function reads a binding assigned anywhere, directly or through a same-module function. */
function readsChangingState(ctx: Context, fn: AstNode, visited: Set<number>): boolean {
  const range = getRange(fn);

  // A global that can change, or a member that reads hidden state, makes the function impure.
  for (const reference of ctx.globals) {
    if (isInside(reference.range, range)) {
      const node: unknown = reference.node;
      const name = isNode(node) ? getName(node) : undefined;
      if (name === undefined || !STABLE_GLOBALS.has(name)) {
        return true;
      }
    }
  }
  const readsHiddenMember = !walkNodes(fn, (node) => {
    if (node.type !== 'MemberExpression') {
      return true;
    }
    const name = getMemberName(node);
    return name === undefined || !IMPURE_MEMBERS.has(name);
  });
  if (readsHiddenMember) {
    return true;
  }
  for (const binding of ctx.scope.bindings) {
    if (isInside(binding.declaration, range)) {
      continue;
    }
    let isRead = false;
    for (const reference of binding.references) {
      if (isInside(reference.range, range)) {
        isRead = true;
        break;
      }
    }
    if (!isRead) {
      continue;
    }
    for (const reference of binding.references) {
      if (reference.write) {
        return true;
      }
    }
    // Follow calls into other functions of the module.
    if (!visited.has(binding.id) && ctx.scope.scopes[binding.scope].kind === 'module') {
      visited.add(binding.id);
      const next = findFunctionNode(ctx, binding);
      if (next && readsChangingState(ctx, next, visited)) {
        return true;
      }
    }
  }
  return false;
}

/** True when an outer binding keeps one value for the whole module's life. */
export function isStableOuter(ctx: Context, binding: Binding): boolean {
  if (ctx.scope.scopes[binding.scope].kind !== 'module') {
    return false;
  }
  // Imported functions are assumed pure. A same-module function must not read changing state.
  if (binding.kind === 'import' || binding.kind === 'class') {
    return true;
  }
  const fn = findFunctionNode(ctx, binding);
  if (fn) {
    return !readsChangingState(ctx, fn, new Set([binding.id]));
  }
  const init = findInitializer(ctx, binding);
  return init !== undefined && PLAIN_INITIALIZERS.has(init.type);
}

/** True when a binding may be read by a cached block placed before `statementStart`. */
export function isPlainInput(ctx: Context, binding: Binding, statementStart: number): boolean {
  // A mutated value, or a binding that is ever assigned, can change under a cached block.
  if (ctx.unsafe.has(binding.id)) {
    return false;
  }
  // A loop counter is written by its loop header only, so each pass of the body sees one value.
  if (ctx.perIteration?.has(binding.id)) {
    return binding.declaration.end <= statementStart;
  }
  for (const reference of binding.references) {
    if (reference.write) {
      return false;
    }
  }
  if (!isInside(binding.declaration, ctx.unitRange)) {
    return isStableOuter(ctx, binding);
  }
  // A binding declared after the statement may not exist yet when the block runs.
  return binding.declaration.end <= statementStart && !isHiddenState(ctx, binding);
}

/** True when the node is only read by whatever holds it, never changed or handed to a call. */
function isReadOnlyUse(ctx: Context, node: AstNode): boolean {
  const parent = ctx.index.parents.get(node);
  if (!parent) {
    return false;
  }
  switch (parent.type) {
    case 'JSXExpressionContainer':
    case 'JSXSpreadAttribute':
    case 'JSXSpreadChild':
    case 'BinaryExpression':
    case 'TemplateLiteral':
      return true;
    case 'UnaryExpression':
      return parent.operator !== 'delete';
    case 'MemberExpression':
      // `x.a` reads. `x.f()` may change `x`, and `x[i] = v` does.
      return getChild(parent, 'object') === node ? isReadOnlyUse(ctx, parent) : true;
    case 'ConditionalExpression':
      return getChild(parent, 'test') === node || isReadOnlyUse(ctx, parent);
    case 'ChainExpression':
    case 'LogicalExpression':
    case 'TSNonNullExpression':
    case 'TSAsExpression':
      return isReadOnlyUse(ctx, parent);
    default:
      return false;
  }
}

/** True when every use of the call result `binding` only reads it. */
export function isResultReadOnly(ctx: Context, binding: Binding): boolean {
  for (const reference of binding.references) {
    const node: unknown = reference.node;
    if (reference.write || !isNode(node) || !isReadOnlyUse(ctx, node)) {
      return false;
    }
  }
  return true;
}

/** Checks the syntax of a candidate. Returns false when any part may change or read hidden state. */
export function isPureSyntax(ctx: Context, expr: AstNode): boolean {
  const range = getRange(expr);
  return walkNodes(expr, (node) => {
    switch (node.type) {
      case 'ThisExpression':
      case 'Super':
      case 'MetaProperty':
      case 'AwaitExpression':
      case 'YieldExpression':
      case 'ImportExpression':
        return false;
      case 'UnaryExpression':
        return node.operator !== 'delete';
      case 'AssignmentExpression':
      case 'UpdateExpression': {
        // Only a name declared inside the candidate may change.
        const target = getChild(node, node.type === 'UpdateExpression' ? 'argument' : 'left');
        const binding =
          target?.type === 'Identifier'
            ? ctx.refs.find((item) => item.reference.range.start === target.start)?.binding
            : undefined;
        return binding !== undefined && isInside(binding.declaration, range);
      }
      case 'CallExpression': {
        // A callee with no fixed name could be a hook or a mutator.
        const name = getCalleeName(node);
        return name !== undefined && !HOOK_NAME.test(name) && !MUTATORS.has(name);
      }
      case 'MemberExpression': {
        const name = getMemberName(node);
        if (name !== undefined) {
          return !IMPURE_MEMBERS.has(name);
        }
        // `Math[key]` can reach `random`. Other objects may be indexed by a name.
        const object = getChild(node, 'object');
        return !(
          object?.type === 'Identifier' &&
          !ctx.refs.some((item) => item.reference.range.start === object.start)
        );
      }
      default:
        return true;
    }
  });
}

export function isElement(
  node: AstNode | undefined,
): node is AstNode & { type: 'JSXElement' | 'JSXFragment' } {
  return node?.type === 'JSXElement' || node?.type === 'JSXFragment';
}

export function createLocal(ctx: Context, index: number): string {
  let name = `_t${index}`;
  while (ctx.names.has(name)) {
    name = `_${name}`;
  }
  ctx.names.add(name);
  return name;
}

export function createContext(
  scope: ScopeResult,
  ownership: OwnershipResult,
  unitRange: Range,
): Context | undefined {
  // Parse results carry the unresolved references. Without them no global can be checked.
  const unresolved = (scope as Partial<ParseResult>).globals;
  if (!unresolved) {
    return undefined;
  }

  const refs: UnitRef[] = [];
  const names = new Set<string>();
  for (const binding of scope.bindings) {
    names.add(binding.name);
    for (const reference of binding.references) {
      if (isInside(reference.range, unitRange)) {
        refs.push({ reference, binding });
      }
    }
  }
  refs.sort((a, b) => a.reference.range.start - b.reference.range.start);

  const unsafe = new Set<number>(ownership.opaque);
  for (const group of ownership.groups) {
    if (group.mutations.length > 0) {
      for (const member of group.members) {
        unsafe.add(member);
      }
    }
  }
  return {
    scope,
    index: indexProgram(scope.program),
    unitRange,
    unsafe,
    refs,
    globals: unresolved,
    names,
  };
}
