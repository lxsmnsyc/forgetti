import type { IdentifierReference, JSXIdentifier } from 'oxc-parser';
import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type { Binding, Range, Reference, Scope } from '../ir';

/** Scopes, bindings and references of a whole module, before units are known. */
export interface ScopeTable {
  scopes: Scope[];
  /** In creation order. `parseAndScope` renumbers them. */
  bindings: Binding[];
  /** References with no binding, such as `window` or an undeclared name. */
  globals: Reference[];
  /** Both reference nodes and declaring identifiers map to their binding. */
  bindingOf: Map<object, Binding>;
  /** The scope each function node opens. */
  functionScopes: Map<object, number>;
}

interface PendingReference {
  node: AstNode;
  scope: number;
  write: boolean;
}

interface State {
  scopes: Scope[];
  /** Names declared in each scope, by scope id. */
  names: Map<string, Binding>[];
  /** The scope that receives `var` declarations made in each scope. */
  hoist: number[];
  /** The scope that receives `let`, `const`, `class` and `function` declarations made in each scope. */
  lexical: number[];
  bindings: Binding[];
  pending: PendingReference[];
  bindingOf: Map<object, Binding>;
  functionScopes: Map<object, number>;
}

type BindingKind = Binding['kind'];

// Keys that hold only types. Their identifiers are never references.
const TYPE_KEYS = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
]);

// TS nodes that wrap a runtime expression.
const TS_EXPRESSIONS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

const LOGICAL_ASSIGNMENTS = new Set(['&&=', '||=', '??=']);

/** Narrows an identifier or JSX identifier node. Both can be references. */
export function isIdentifierReference(
  value: unknown,
): value is IdentifierReference | JSXIdentifier {
  return isNode(value) && (value.type === 'Identifier' || value.type === 'JSXIdentifier');
}

function getRange(node: AstNode): Range {
  return { start: node.start, end: node.end };
}

function getName(node: AstNode): string {
  return typeof node.name === 'string' ? node.name : '';
}

function createScope(
  state: State,
  parent: number | null,
  kind: Scope['kind'],
  range: Range,
  receivesVar = false,
): number {
  const id = state.scopes.length;
  state.scopes.push({ id, parent, kind, range });
  state.names.push(new Map());
  const isHoistTarget = receivesVar || parent === null || kind === 'function' || kind === 'unit';
  state.hoist.push(isHoistTarget ? id : state.hoist[parent]);
  state.lexical.push(id);
  return id;
}

function declare(
  state: State,
  scope: number,
  id: AstNode,
  kind: BindingKind,
  imported?: Binding['imported'],
): void {
  const name = getName(id);
  const names = state.names[scope];

  // A repeated `var` or function name declares the same binding again.
  const existing = names.get(name);
  if (existing) {
    state.bindingOf.set(id, existing);
    return;
  }

  const binding: Binding = {
    id: state.bindings.length,
    name,
    kind,
    declaration: getRange(id),
    scope,
    references: [],
  };
  if (imported) {
    binding.imported = imported;
  }
  state.bindings.push(binding);
  names.set(name, binding);
  state.bindingOf.set(id, binding);
}

function addReference(state: State, node: AstNode, scope: number, write: boolean): void {
  state.pending.push({ node, scope, write });
}

/** Declares every name in a binding pattern. Default values and computed keys are read in `scope`. */
function declarePattern(
  state: State,
  pattern: AstNode,
  target: number,
  scope: number,
  kind: BindingKind,
): void {
  switch (pattern.type) {
    case 'Identifier':
      declare(state, target, pattern, kind);
      break;
    case 'ObjectPattern':
      for (const property of getChildren(pattern, 'properties')) {
        if (property.type === 'RestElement') {
          declarePattern(state, property, target, scope, kind);
          continue;
        }
        const key = getChild(property, 'key');
        if (property.computed === true && key) {
          walk(state, key, scope);
        }
        const value = getChild(property, 'value');
        if (value) {
          declarePattern(state, value, target, scope, kind);
        }
      }
      break;
    case 'ArrayPattern':
      for (const element of getChildren(pattern, 'elements')) {
        declarePattern(state, element, target, scope, kind);
      }
      break;
    case 'RestElement': {
      const argument = getChild(pattern, 'argument');
      if (argument) {
        declarePattern(state, argument, target, scope, kind);
      }
      break;
    }
    case 'AssignmentPattern': {
      const left = getChild(pattern, 'left');
      const right = getChild(pattern, 'right');
      if (left) {
        declarePattern(state, left, target, scope, kind);
      }
      if (right) {
        walk(state, right, scope);
      }
      break;
    }
    case 'TSParameterProperty': {
      const parameter = getChild(pattern, 'parameter');
      if (parameter) {
        declarePattern(state, parameter, target, scope, kind);
      }
      break;
    }
    default:
      break;
  }
}

/** Walks an assignment target. Names it assigns are write references, and everything else is read. */
function walkTarget(state: State, target: AstNode, scope: number): void {
  switch (target.type) {
    case 'Identifier':
      addReference(state, target, scope, true);
      break;
    case 'ObjectPattern':
      for (const property of getChildren(target, 'properties')) {
        if (property.type === 'RestElement') {
          walkTarget(state, property, scope);
          continue;
        }
        const key = getChild(property, 'key');
        if (property.computed === true && key) {
          walk(state, key, scope);
        }
        const value = getChild(property, 'value');
        if (value) {
          walkTarget(state, value, scope);
        }
      }
      break;
    case 'ArrayPattern':
      for (const element of getChildren(target, 'elements')) {
        walkTarget(state, element, scope);
      }
      break;
    case 'RestElement': {
      const argument = getChild(target, 'argument');
      if (argument) {
        walkTarget(state, argument, scope);
      }
      break;
    }
    case 'AssignmentPattern': {
      const left = getChild(target, 'left');
      const right = getChild(target, 'right');
      if (left) {
        walkTarget(state, left, scope);
      }
      if (right) {
        walk(state, right, scope);
      }
      break;
    }
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion': {
      const expression = getChild(target, 'expression');
      if (expression) {
        walkTarget(state, expression, scope);
      }
      break;
    }
    default:
      // A member expression reads its object and computed property.
      walk(state, target, scope);
      break;
  }
}

/** Walks the statements of a block in `scope`, without opening another scope. */
function walkBody(state: State, node: AstNode, scope: number): void {
  if (node.type === 'BlockStatement' || node.type === 'StaticBlock') {
    for (const statement of getChildren(node, 'body')) {
      walk(state, statement, scope);
    }
    return;
  }
  walk(state, node, scope);
}

/** Opens a scope of `kind` for `node` and walks it there. Used for branch arms and loop bodies. */
function walkInScope(state: State, node: AstNode, scope: number, kind: Scope['kind']): void {
  walkBody(state, node, createScope(state, scope, kind, getRange(node)));
}

/** True when a parameter pattern holds a default value or a computed key. */
function hasParameterExpressions(pattern: AstNode): boolean {
  switch (pattern.type) {
    case 'AssignmentPattern':
      return true;
    case 'ObjectPattern':
      for (const property of getChildren(pattern, 'properties')) {
        if (property.computed === true) {
          return true;
        }
        const value = getChild(property, property.type === 'RestElement' ? 'argument' : 'value');
        if (value && hasParameterExpressions(value)) {
          return true;
        }
      }
      return false;
    case 'ArrayPattern':
      for (const element of getChildren(pattern, 'elements')) {
        if (hasParameterExpressions(element)) {
          return true;
        }
      }
      return false;
    case 'RestElement': {
      const argument = getChild(pattern, 'argument');
      return argument !== undefined && hasParameterExpressions(argument);
    }
    case 'TSParameterProperty': {
      const parameter = getChild(pattern, 'parameter');
      return parameter !== undefined && hasParameterExpressions(parameter);
    }
    default:
      return false;
  }
}

function walkFunction(state: State, node: AstNode, parent: number): void {
  // A function expression's own name is visible only inside it, in a scope of its own.
  const id = getChild(node, 'id');
  let outer = parent;
  if (id && node.type === 'FunctionExpression') {
    outer = createScope(state, parent, 'block', getRange(node));
    declare(state, outer, id, 'function');
  }
  const scope = createScope(state, outer, 'function', getRange(node));
  state.functionScopes.set(node, scope);

  // A TS `this` parameter declares nothing.
  let hasExpressions = false;
  for (const param of getChildren(node, 'params')) {
    if (param.type === 'Identifier' && getName(param) === 'this') {
      continue;
    }
    hasExpressions ||= hasParameterExpressions(param);
    declarePattern(state, param, scope, scope, 'param');
  }

  // With a default value or computed key in the parameters, the body gets its own scope,
  // as the spec says. Defaults then never see the body's declarations.
  const body = getChild(node, 'body');
  if (!body) {
    return;
  }
  if (hasExpressions && body.type === 'BlockStatement') {
    walkBody(state, body, createScope(state, scope, 'block', getRange(body), true));
    return;
  }
  walkBody(state, body, scope);
}

function walkClass(state: State, node: AstNode, scope: number): void {
  for (const decorator of getChildren(node, 'decorators')) {
    walk(state, decorator, scope);
  }
  const superClass = getChild(node, 'superClass');
  if (superClass) {
    walk(state, superClass, scope);
  }
  const body = getChild(node, 'body');
  if (!body) {
    return;
  }
  for (const element of getChildren(body, 'body')) {
    if (element.type === 'StaticBlock') {
      walk(state, element, scope);
      continue;
    }
    for (const decorator of getChildren(element, 'decorators')) {
      walk(state, decorator, scope);
    }
    const key = getChild(element, 'key');
    if (element.computed === true && key) {
      walk(state, key, scope);
    }
    const value = getChild(element, 'value');
    if (value) {
      walk(state, value, scope);
    }
  }
}

function walkVariableDeclaration(state: State, node: AstNode, scope: number): void {
  // `using` and `await using` bind like `const`.
  let kind: BindingKind = 'const';
  if (node.kind === 'var' || node.kind === 'let') {
    kind = node.kind;
  }
  const target = kind === 'var' ? state.hoist[scope] : state.lexical[scope];
  for (const declarator of getChildren(node, 'declarations')) {
    const id = getChild(declarator, 'id');
    if (id) {
      declarePattern(state, id, target, scope, kind);
    }
    const init = getChild(declarator, 'init');
    if (init) {
      walk(state, init, scope);
    }
  }
}

function walkImport(state: State, node: AstNode, scope: number): void {
  // Type-only imports declare no value.
  if (node.importKind === 'type') {
    return;
  }
  const sourceNode = getChild(node, 'source');
  const source = sourceNode && typeof sourceNode.value === 'string' ? sourceNode.value : '';
  for (const specifier of getChildren(node, 'specifiers')) {
    const local = getChild(specifier, 'local');
    if (!local || specifier.importKind === 'type') {
      continue;
    }
    let name = '*';
    if (specifier.type === 'ImportDefaultSpecifier') {
      name = 'default';
    } else if (specifier.type === 'ImportSpecifier') {
      const imported = getChild(specifier, 'imported');
      if (imported) {
        name = imported.type === 'Identifier' ? getName(imported) : String(imported.value);
      }
    }
    declare(state, scope, local, 'import', { source, name });
  }
}

function walkJSXName(state: State, name: AstNode, scope: number): void {
  // `<div>` and `<my-element>` are intrinsic tags. `<Child>` and the object of `<a.b>` are references.
  if (name.type === 'JSXIdentifier') {
    const text = getName(name);
    if (/^[a-z]/.test(text) || text.includes('-')) {
      return;
    }
    addReference(state, name, scope, false);
    return;
  }
  if (name.type === 'JSXMemberExpression') {
    let object = getChild(name, 'object');
    while (object?.type === 'JSXMemberExpression') {
      object = getChild(object, 'object');
    }
    // `<this.Foo>` reads `this`, which is not a binding.
    if (object?.type === 'JSXIdentifier' && getName(object) !== 'this') {
      addReference(state, object, scope, false);
    }
  }
}

/** Walks every child node except type-only keys. */
function walkChildren(state: State, node: AstNode, scope: number): void {
  for (const key of Object.keys(node)) {
    if (TYPE_KEYS.has(key)) {
      continue;
    }
    const value = node[key];
    if (isNode(value)) {
      walk(state, value, scope);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          walk(state, item, scope);
        }
      }
    }
  }
}

function walk(state: State, node: AstNode, scope: number): void {
  switch (node.type) {
    case 'Identifier':
      addReference(state, node, scope, false);
      return;
    case 'ImportDeclaration':
      walkImport(state, node, scope);
      return;
    case 'ExportNamedDeclaration': {
      const declaration = getChild(node, 'declaration');
      if (declaration) {
        walk(state, declaration, scope);
        return;
      }
      // `export { a as b }` reads `a`. A re-export from another module reads nothing here.
      if (getChild(node, 'source') || node.exportKind === 'type') {
        return;
      }
      for (const specifier of getChildren(node, 'specifiers')) {
        const local = getChild(specifier, 'local');
        if (local?.type === 'Identifier' && specifier.exportKind !== 'type') {
          addReference(state, local, scope, false);
        }
      }
      return;
    }
    case 'ExportAllDeclaration':
      return;
    case 'VariableDeclaration':
      walkVariableDeclaration(state, node, scope);
      return;
    case 'FunctionDeclaration': {
      const id = getChild(node, 'id');
      if (id) {
        declare(state, state.lexical[scope], id, 'function');
      }
      walkFunction(state, node, scope);
      return;
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      walkFunction(state, node, scope);
      return;
    case 'ClassDeclaration': {
      const id = getChild(node, 'id');
      if (id) {
        declare(state, state.lexical[scope], id, 'class');
      }
      walkClass(state, node, scope);
      return;
    }
    case 'ClassExpression': {
      // A class expression's own name is visible only inside the class.
      const id = getChild(node, 'id');
      if (!id) {
        walkClass(state, node, scope);
        return;
      }
      const inner = createScope(state, scope, 'block', getRange(node));
      declare(state, inner, id, 'class');
      walkClass(state, node, inner);
      return;
    }
    case 'BlockStatement':
      walkInScope(state, node, scope, 'block');
      return;
    case 'StaticBlock':
      // A static block keeps its own `var` declarations, like a function body.
      walkBody(state, node, createScope(state, scope, 'block', getRange(node), true));
      return;
    case 'IfStatement': {
      const test = getChild(node, 'test');
      const consequent = getChild(node, 'consequent');
      const alternate = getChild(node, 'alternate');
      if (test) {
        walk(state, test, scope);
      }
      if (consequent) {
        walkInScope(state, consequent, scope, 'branch');
      }
      if (alternate) {
        walkInScope(state, alternate, scope, 'branch');
      }
      return;
    }
    case 'SwitchStatement': {
      const discriminant = getChild(node, 'discriminant');
      if (discriminant) {
        walk(state, discriminant, scope);
      }

      // All cases share one lexical scope. Each case runs in its own branch scope inside it.
      const body = createScope(state, scope, 'block', getRange(node));
      for (const switchCase of getChildren(node, 'cases')) {
        const test = getChild(switchCase, 'test');
        if (test) {
          walk(state, test, body);
        }
        const branch = createScope(state, body, 'branch', getRange(switchCase));
        state.lexical[branch] = body;
        for (const statement of getChildren(switchCase, 'consequent')) {
          walk(state, statement, branch);
        }
      }
      return;
    }
    case 'ConditionalExpression': {
      const test = getChild(node, 'test');
      const consequent = getChild(node, 'consequent');
      const alternate = getChild(node, 'alternate');
      if (test) {
        walk(state, test, scope);
      }
      if (consequent) {
        walkInScope(state, consequent, scope, 'branch');
      }
      if (alternate) {
        walkInScope(state, alternate, scope, 'branch');
      }
      return;
    }
    case 'LogicalExpression': {
      const left = getChild(node, 'left');
      const right = getChild(node, 'right');
      if (left) {
        walk(state, left, scope);
      }
      if (right) {
        walkInScope(state, right, scope, 'branch');
      }
      return;
    }
    case 'AssignmentExpression': {
      const left = getChild(node, 'left');
      const right = getChild(node, 'right');
      if (left) {
        walkTarget(state, left, scope);
      }
      if (right) {
        // `a ||= b` evaluates `b` only on one path.
        if (typeof node.operator === 'string' && LOGICAL_ASSIGNMENTS.has(node.operator)) {
          walkInScope(state, right, scope, 'branch');
        } else {
          walk(state, right, scope);
        }
      }
      return;
    }
    case 'UpdateExpression': {
      const argument = getChild(node, 'argument');
      if (argument) {
        walkTarget(state, argument, scope);
      }
      return;
    }
    case 'ForStatement': {
      const loop = createScope(state, scope, 'loop', getRange(node));
      const init = getChild(node, 'init');
      const test = getChild(node, 'test');
      const update = getChild(node, 'update');
      const body = getChild(node, 'body');
      if (init) {
        walk(state, init, loop);
      }
      if (test) {
        walk(state, test, loop);
      }
      if (update) {
        walk(state, update, loop);
      }
      if (body) {
        walk(state, body, loop);
      }
      return;
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      // The right side runs once, before the loop.
      const right = getChild(node, 'right');
      if (right) {
        walk(state, right, scope);
      }
      const loop = createScope(state, scope, 'loop', getRange(node));
      const left = getChild(node, 'left');
      const body = getChild(node, 'body');
      if (left?.type === 'VariableDeclaration') {
        walkVariableDeclaration(state, left, loop);
      } else if (left) {
        walkTarget(state, left, loop);
      }
      if (body) {
        walk(state, body, loop);
      }
      return;
    }
    case 'WhileStatement':
    case 'DoWhileStatement': {
      const loop = createScope(state, scope, 'loop', getRange(node));
      const test = getChild(node, 'test');
      const body = getChild(node, 'body');
      if (test) {
        walk(state, test, loop);
      }
      if (body) {
        walk(state, body, loop);
      }
      return;
    }
    case 'CatchClause': {
      // The parameter and the body share one scope: `catch (e) { let e; }` is a syntax error.
      const catchScope = createScope(state, scope, 'catch', getRange(node));
      const param = getChild(node, 'param');
      if (param) {
        declarePattern(state, param, catchScope, catchScope, 'catch');
      }
      const body = getChild(node, 'body');
      if (body) {
        walkBody(state, body, catchScope);
      }
      return;
    }
    case 'LabeledStatement': {
      const body = getChild(node, 'body');
      if (body) {
        walk(state, body, scope);
      }
      return;
    }
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'MetaProperty':
    case 'PrivateIdentifier':
      return;
    case 'MemberExpression': {
      const object = getChild(node, 'object');
      const property = getChild(node, 'property');
      if (object) {
        walk(state, object, scope);
      }
      if (property && node.computed === true) {
        walk(state, property, scope);
      }
      return;
    }
    case 'Property': {
      const key = getChild(node, 'key');
      const value = getChild(node, 'value');
      if (key && node.computed === true) {
        walk(state, key, scope);
      }
      // A shorthand property holds the reference in `value`, as a separate node from `key`.
      if (value) {
        walk(state, value, scope);
      }
      return;
    }
    case 'JSXOpeningElement': {
      const name = getChild(node, 'name');
      if (name) {
        walkJSXName(state, name, scope);
      }
      for (const attribute of getChildren(node, 'attributes')) {
        const value = getChild(attribute, attribute.type === 'JSXAttribute' ? 'value' : 'argument');
        if (value) {
          walk(state, value, scope);
        }
      }
      return;
    }
    case 'JSXClosingElement':
      return;
    case 'TSEnumDeclaration': {
      // Enum members are not walked. Their initializers are constant in practice.
      const id = getChild(node, 'id');
      if (id) {
        declare(state, state.lexical[scope], id, 'const');
      }
      return;
    }
    case 'TSParameterProperty':
      declarePattern(state, node, scope, scope, 'param');
      return;
    case 'TSExportAssignment': {
      const expression = getChild(node, 'expression');
      if (expression) {
        walk(state, expression, scope);
      }
      return;
    }
    default:
      break;
  }

  // Other TS nodes are types, except wrappers around an expression.
  if (node.type.startsWith('TS')) {
    if (TS_EXPRESSIONS.has(node.type)) {
      const expression = getChild(node, 'expression');
      if (expression) {
        walk(state, expression, scope);
      }
    }
    return;
  }
  walkChildren(state, node, scope);
}

function resolve(state: State, name: string, scope: number): Binding | undefined {
  for (
    let current: number | null = scope;
    current !== null;
    current = state.scopes[current].parent
  ) {
    const binding = state.names[current].get(name);
    if (binding) {
      return binding;
    }
  }
  return undefined;
}

/**
 * Builds the scopes, bindings and references of a module.
 * Scope 0 is the module scope.
 */
export function buildScopes(program: AstNode): ScopeTable {
  const state: State = {
    scopes: [],
    names: [],
    hoist: [],
    lexical: [],
    bindings: [],
    pending: [],
    bindingOf: new Map(),
    functionScopes: new Map(),
  };

  // Declare everything first, so hoisted names resolve from anywhere.
  const root = createScope(state, null, 'module', getRange(program));
  for (const statement of getChildren(program, 'body')) {
    walk(state, statement, root);
  }

  // Resolve each reference up the scope chain.
  const globals: Reference[] = [];
  for (const pending of state.pending) {
    if (!isIdentifierReference(pending.node)) {
      continue;
    }
    const reference: Reference = {
      range: getRange(pending.node),
      write: pending.write,
      node: pending.node,
      scope: pending.scope,
    };
    const binding = resolve(state, getName(pending.node), pending.scope);
    if (binding) {
      binding.references.push(reference);
      state.bindingOf.set(pending.node, binding);
    } else {
      globals.push(reference);
    }
  }

  // The walk visits a `for...of` right side before its left side, so sort by position.
  for (const binding of state.bindings) {
    binding.references.sort((a, b) => a.range.start - b.range.start);
  }
  globals.sort((a, b) => a.range.start - b.range.start);

  return {
    scopes: state.scopes,
    bindings: state.bindings,
    globals,
    bindingOf: state.bindingOf,
    functionScopes: state.functionScopes,
  };
}
