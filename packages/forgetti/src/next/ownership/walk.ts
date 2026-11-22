import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type { Binding, Range, ScopeResult } from '../ir';
import { isIdentifierReference } from '../parse/scope';
import {
  CALLBACK_METHODS,
  KNOWN_CONSTRUCTORS,
  MUTATING_METHODS,
  PRIMITIVE_METHODS,
  PRIMITIVE_PROPERTIES,
  PURE_FUNCTIONS,
  PURE_MEMBERS,
  READ_METHODS,
} from './methods';

const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'ChainExpression',
]);

const HOOK_NAME = /^use[A-Z0-9]/;

/** A fresh literal: an object, array, `new`, closure, class or JSX value made in this render. */
export interface Created {
  range: Range;
  /** True for a function or class, which can run code later. */
  closure: boolean;
  /** True for a closure that changes a captured fresh value when it runs. */
  mutating?: boolean;
}

/** An `if` test, loop test or logical left side that decides whether `arm` runs. */
export interface Control {
  reads: Range[];
  arm: Range;
}

/** Where a binding receives a value: a declarator, an assignment or a closure declaration. */
export interface Site {
  binding: number;
  range: Range;
  created: Created[];
  controls: Control[];
}

export interface MutationSite {
  binding: number;
  range: Range;
  controls: Control[];
}

/** A value that leaves render: a JSX prop or child, a return value or a call argument. */
export interface Escape {
  bindings: number[];
  range: Range;
  /** True when the value is or holds a mutating closure, which may run after render. */
  mutating: boolean;
}

/** What one walk of a unit found. Only the last walk, run with the final fresh set, is kept. */
export interface Facts {
  /** Bindings that received a fresh value or an alias of one. */
  fresh: Set<number>;
  /** Bindings that hold a mutating closure, directly or inside another value. */
  holders: Set<number>;
  unions: [number, number][];
  sites: Site[];
  mutations: MutationSite[];
  escapes: Escape[];
  /** Non-fresh locals changed during render, and locals written inside a closure. */
  opaque: Set<number>;
  /** Ranges that compute each binding's value, for input tracing. */
  sources: Map<number, Range[]>;
  /** Consts whose initializer has no call, so their inputs can be traced through. */
  traceable: Set<number>;
  hookResults: Set<number>;
  /** `const a = b` or `const a = b.c`: a mutation of non-fresh `a` changes `b` too. */
  aliasOf: Map<number, number>;
}

/** A call of a callback method such as `forEach`, with its parts. */
interface CallbackCall {
  name: string;
  args: Value[];
  argNodes: AstNode[];
  receiver: Value;
}

/** The fresh bindings an expression may evaluate to or contain, and the literals it creates. */
interface Value {
  candidates: Set<number>;
  created: Created[];
}

function createValue(): Value {
  return { candidates: new Set(), created: [] };
}

function mergeValues(target: Value, source: Value): Value {
  for (const candidate of source.candidates) {
    target.candidates.add(candidate);
  }
  target.created.push(...source.created);
  return target;
}

function isFreshValue(value: Value): boolean {
  return value.candidates.size > 0 || value.created.length > 0;
}

export function unwrap(node: AstNode): AstNode {
  let current = node;
  for (;;) {
    const inner = getChild(current, 'expression');
    if (!WRAPPERS.has(current.type) || !inner) {
      return current;
    }
    current = inner;
  }
}

export function toRange(node: AstNode): Range {
  return { start: node.start, end: node.end };
}

export function isFunctionNode(node: AstNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

export function listChildNodes(node: AstNode): AstNode[] {
  const result: AstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'parent') {
      continue;
    }
    const value = node[key];
    if (isNode(value)) {
      result.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push(item);
        }
      }
    }
  }
  return result;
}

function getPropertyName(member: AstNode): string | undefined {
  const property = getChild(member, 'property');
  if (member.computed === true || !property) {
    return undefined;
  }
  return typeof property.name === 'string' ? property.name : undefined;
}

/** True when the expression runs a call, outside nested functions. */
function hasCall(node: AstNode): boolean {
  switch (node.type) {
    case 'CallExpression':
    case 'NewExpression':
    case 'TaggedTemplateExpression':
    case 'AwaitExpression':
    case 'YieldExpression':
      return true;
    default:
      break;
  }
  if (isFunctionNode(node) || node.type === 'ClassExpression') {
    return false;
  }
  for (const child of listChildNodes(node)) {
    if (hasCall(child)) {
      return true;
    }
  }
  return false;
}

function isHookCall(node: AstNode): boolean {
  const callee = getChild(node, 'callee');
  if (!callee) {
    return false;
  }
  const target = unwrap(callee);
  let name: string | undefined;
  if (target.type === 'Identifier' && typeof target.name === 'string') {
    name = target.name;
  } else if (target.type === 'MemberExpression') {
    name = getPropertyName(target);
  }
  return name !== undefined && HOOK_NAME.test(name);
}

function isInside(inner: Range, outer: Range): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/**
 * Walks the render code of one unit and records stores, mutations and escapes.
 * Nested functions are not walked: a closure is a value, and calling it is a mutation of
 * what it captures.
 */
export class UnitWalker {
  private facts: Facts = UnitWalker.createFacts();

  /** Bindings treated as fresh in this walk, from the previous walk. */
  private fresh = new Set<number>();

  /** Bindings that hold a mutating closure, from the previous walk. */
  private holders = new Set<number>();

  constructor(
    private readonly scope: ScopeResult,
    /** Render-level bindings of the unit: not parameters and not inside a closure. */
    private readonly locals: Set<number>,
    /** References to locals, for closure captures. */
    private readonly localReferences: { binding: number; range: Range; write: boolean }[],
  ) {}

  private static createFacts(): Facts {
    return {
      fresh: new Set(),
      holders: new Set(),
      unions: [],
      sites: [],
      mutations: [],
      escapes: [],
      opaque: new Set(),
      sources: new Map(),
      traceable: new Set(),
      hookResults: new Set(),
      aliasOf: new Map(),
    };
  }

  /** Walks the body until the fresh and holder sets stop growing, and returns the last walk's facts. */
  run(body: AstNode): Facts {
    for (;;) {
      this.facts = UnitWalker.createFacts();
      if (body.type === 'BlockStatement') {
        this.walkStatements(getChildren(body, 'body'), []);
      } else {
        // An arrow function with an expression body returns it.
        const value = this.evaluate(body, []);
        this.recordEscape(value, body);
      }
      const { fresh, holders } = this.facts;
      if (fresh.size <= this.fresh.size && holders.size <= this.holders.size) {
        return this.facts;
      }
      this.fresh = fresh;
      this.holders = holders;
    }
  }

  private getLocal(node: AstNode): Binding | undefined {
    if (!isIdentifierReference(node)) {
      return undefined;
    }
    const binding = this.scope.bindingOf(node);
    return binding && this.locals.has(binding.id) ? binding : undefined;
  }

  private isGlobal(node: AstNode, name: string): boolean {
    return (
      node.type === 'Identifier' &&
      node.name === name &&
      isIdentifierReference(node) &&
      this.scope.bindingOf(node) === undefined
    );
  }

  /** The local at the root of a member chain such as `a.b[c]`. */
  private findRootLocal(node: AstNode): Binding | undefined {
    let current = unwrap(node);
    while (current.type === 'MemberExpression') {
      const object = getChild(current, 'object');
      if (!object) {
        return undefined;
      }
      current = unwrap(object);
    }
    return current.type === 'Identifier' ? this.getLocal(current) : undefined;
  }

  // Recording

  private store(binding: number, value: Value, site: AstNode, controls: Control[]): void {
    if (!isFreshValue(value)) {
      return;
    }
    this.facts.fresh.add(binding);
    if (this.isMutatingValue(value)) {
      this.facts.holders.add(binding);
    }
    for (const candidate of value.candidates) {
      if (candidate !== binding) {
        this.facts.unions.push([binding, candidate]);
      }
    }
    this.facts.sites.push({
      binding,
      range: toRange(site),
      created: value.created,
      controls,
    });
  }

  private addSource(binding: number, node: AstNode): void {
    const list = this.facts.sources.get(binding);
    if (list) {
      list.push(toRange(node));
    } else {
      this.facts.sources.set(binding, [toRange(node)]);
    }
  }

  /**
   * A write through `binding`. A member write on a non-fresh local makes it opaque. A rebind
   * of a non-fresh local changes nothing ownership tracks.
   */
  private markMutation(
    binding: Binding,
    node: AstNode,
    controls: Control[],
    rebind: boolean,
  ): void {
    if (this.fresh.has(binding.id)) {
      this.facts.mutations.push({ binding: binding.id, range: toRange(node), controls });
    } else if (!rebind) {
      this.facts.opaque.add(binding.id);
    }
  }

  private mutateAll(candidates: Iterable<number>, node: AstNode, controls: Control[]): void {
    for (const candidate of candidates) {
      this.facts.mutations.push({ binding: candidate, range: toRange(node), controls });
    }
  }

  private recordEscape(value: Value, node: AstNode): void {
    if (value.candidates.size > 0) {
      this.facts.escapes.push({
        bindings: [...value.candidates],
        range: toRange(node),
        mutating: this.isMutatingValue(value),
      });
    }
  }

  /** True when the value is or holds a closure that changes a captured fresh value. */
  private isMutatingValue(value: Value): boolean {
    for (const created of value.created) {
      if (created.mutating === true) {
        return true;
      }
    }
    for (const candidate of value.candidates) {
      if (this.holders.has(candidate)) {
        return true;
      }
    }
    return false;
  }

  /** Joins every candidate of `values` into one group, as an unknown call may store one in another. */
  private joinAll(values: Value[], site: AstNode, controls: Control[]): Value {
    const result = createValue();
    for (const value of values) {
      mergeValues(result, value);
    }
    const anchor = result.candidates.values().next().value;
    if (anchor !== undefined) {
      this.store(anchor, result, site, controls);
    }
    return result;
  }

  // Statements

  private walkStatements(statements: AstNode[], controls: Control[]): void {
    // Function declarations are hoisted, so they are values before the first statement runs.
    for (const statement of statements) {
      if (statement.type === 'FunctionDeclaration') {
        this.declareClosure(statement, controls);
      }
    }
    for (const statement of statements) {
      if (statement.type !== 'FunctionDeclaration') {
        this.walkStatement(statement, controls);
      }
    }
  }

  private declareClosure(node: AstNode, controls: Control[]): void {
    const id = getChild(node, 'id');
    const binding = id ? this.getLocal(id) : undefined;
    const value = this.captureClosure(node);
    if (binding) {
      this.addSource(binding.id, node);
      this.store(binding.id, value, node, controls);
    }
  }

  private walkStatement(node: AstNode, controls: Control[]): void {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of getChildren(node, 'declarations')) {
          this.walkDeclarator(declarator, controls);
        }
        return;
      case 'ClassDeclaration':
        this.declareClosure(node, controls);
        return;
      case 'FunctionDeclaration':
        this.declareClosure(node, controls);
        return;
      case 'ExpressionStatement': {
        const expression = getChild(node, 'expression');
        if (expression) {
          this.evaluate(expression, controls);
        }
        return;
      }
      case 'ReturnStatement': {
        const argument = getChild(node, 'argument');
        if (argument) {
          this.recordEscape(this.evaluate(argument, controls), argument);
        }
        return;
      }
      case 'BlockStatement':
      case 'StaticBlock':
        this.walkStatements(getChildren(node, 'body'), controls);
        return;
      case 'IfStatement':
        this.walkIf(node, controls);
        return;
      case 'SwitchStatement':
        this.walkSwitch(node, controls);
        return;
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        this.walkLoop(node, controls);
        return;
      case 'ForOfStatement':
      case 'ForInStatement':
        this.walkForOf(node, controls);
        return;
      default:
        break;
    }
    if (node.type.startsWith('TS')) {
      // Type declarations do not run.
      return;
    }
    if (node.type.endsWith('Statement') || node.type.endsWith('Clause')) {
      // Try, labeled and throw statements: walk their parts.
      for (const child of listChildNodes(node)) {
        this.walkStatement(child, controls);
      }
      return;
    }
    // Anything else, such as a throw argument, is evaluated for its effects.
    this.evaluate(node, controls);
  }

  private walkDeclarator(declarator: AstNode, controls: Control[]): void {
    const id = getChild(declarator, 'id');
    const rawInit = getChild(declarator, 'init');
    if (!id) {
      return;
    }
    const init = rawInit ? unwrap(rawInit) : undefined;
    const value = init ? this.evaluate(init, controls) : createValue();

    // Facts the input tracer needs: what computes each name, and whether to trace through it.
    for (const identifier of this.listPatternLocals(id)) {
      this.addSource(identifier.id, declarator);
      if (!init) {
        continue;
      }
      if (identifier.kind === 'const' && !hasCall(init)) {
        this.facts.traceable.add(identifier.id);
      }
      if (init.type === 'CallExpression' && isHookCall(init)) {
        this.facts.hookResults.add(identifier.id);
      }
      const aliased = this.findRootLocal(init);
      if (aliased) {
        this.facts.aliasOf.set(identifier.id, aliased.id);
      }
    }
    this.bindPattern(id, value, rawInit ?? declarator, controls, false);
  }

  private listPatternLocals(pattern: AstNode, result: Binding[] = []): Binding[] {
    switch (pattern.type) {
      case 'Identifier': {
        const binding = this.getLocal(pattern);
        if (binding) {
          result.push(binding);
        }
        break;
      }
      case 'ObjectPattern':
        for (const property of getChildren(pattern, 'properties')) {
          const child = getChild(property, property.type === 'RestElement' ? 'argument' : 'value');
          if (child) {
            this.listPatternLocals(child, result);
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of getChildren(pattern, 'elements')) {
          this.listPatternLocals(element, result);
        }
        break;
      case 'AssignmentPattern':
      case 'RestElement': {
        const child = getChild(pattern, pattern.type === 'RestElement' ? 'argument' : 'left');
        if (child) {
          this.listPatternLocals(child, result);
        }
        break;
      }
      default:
        break;
    }
    return result;
  }

  /**
   * Stores `value` into every name of a pattern. Destructuring may pick any part of the value,
   * so each name joins all of it. `assign` marks targets as rebound, for assignment patterns.
   */
  private bindPattern(
    pattern: AstNode,
    value: Value,
    site: AstNode,
    controls: Control[],
    assign: boolean,
  ): void {
    const target = unwrap(pattern);
    switch (target.type) {
      case 'Identifier': {
        const binding = this.getLocal(target);
        if (binding) {
          if (assign) {
            this.addSource(binding.id, site);
            this.markMutation(binding, site, controls, true);
          }
          this.store(binding.id, value, site, controls);
        }
        return;
      }
      case 'MemberExpression': {
        this.evaluateMemberParts(target, controls);
        const root = this.findRootLocal(target);
        if (root) {
          this.markMutation(root, site, controls, false);
          this.store(root.id, value, site, controls);
        }
        return;
      }
      case 'ObjectPattern':
        for (const property of getChildren(target, 'properties')) {
          if (property.type === 'RestElement') {
            const argument = getChild(property, 'argument');
            if (argument) {
              this.bindPattern(argument, value, site, controls, assign);
            }
            continue;
          }
          const key = getChild(property, 'key');
          if (property.computed === true && key) {
            this.evaluate(key, controls);
          }
          const child = getChild(property, 'value');
          if (child) {
            this.bindPattern(child, value, site, controls, assign);
          }
        }
        return;
      case 'ArrayPattern':
        for (const element of getChildren(target, 'elements')) {
          this.bindPattern(element, value, site, controls, assign);
        }
        return;
      case 'RestElement': {
        const argument = getChild(target, 'argument');
        if (argument) {
          this.bindPattern(argument, value, site, controls, assign);
        }
        return;
      }
      case 'AssignmentPattern': {
        // A default value is stored only when the part is undefined, so the name may hold either.
        const left = getChild(target, 'left');
        const right = getChild(target, 'right');
        const merged = mergeValues(createValue(), value);
        if (right) {
          mergeValues(merged, this.evaluate(right, controls));
        }
        if (left) {
          this.bindPattern(left, merged, site, controls, assign);
        }
        break;
      }
      default:
        break;
    }
  }

  private walkIf(node: AstNode, controls: Control[]): void {
    const test = getChild(node, 'test');
    if (test) {
      this.evaluate(test, controls);
    }
    const reads = test ? [toRange(test)] : [];
    for (const key of ['consequent', 'alternate']) {
      const arm = getChild(node, key);
      if (arm) {
        this.walkStatement(arm, [...controls, { reads, arm: toRange(arm) }]);
      }
    }
  }

  private walkSwitch(node: AstNode, controls: Control[]): void {
    const discriminant = getChild(node, 'discriminant');
    if (discriminant) {
      this.evaluate(discriminant, controls);
    }
    for (const switchCase of getChildren(node, 'cases')) {
      const test = getChild(switchCase, 'test');
      const reads: Range[] = discriminant ? [toRange(discriminant)] : [];
      if (test) {
        this.evaluate(test, controls);
        reads.push(toRange(test));
      }
      this.walkStatements(getChildren(switchCase, 'consequent'), [
        ...controls,
        { reads, arm: toRange(switchCase) },
      ]);
    }
  }

  private walkLoop(node: AstNode, controls: Control[]): void {
    const init = getChild(node, 'init');
    if (init) {
      this.walkStatement(init, controls);
    }
    const reads: Range[] = [];
    const parts: AstNode[] = [];
    for (const key of ['test', 'update']) {
      const part = getChild(node, key);
      if (part) {
        reads.push(toRange(part));
        parts.push(part);
      }
    }
    const body = getChild(node, 'body');
    const inner = [...controls, { reads, arm: toRange(body ?? node) }];
    for (const part of parts) {
      this.evaluate(part, inner);
    }
    if (body) {
      this.walkStatement(body, inner);
    }
  }

  private walkForOf(node: AstNode, controls: Control[]): void {
    const left = getChild(node, 'left');
    const right = getChild(node, 'right');
    const body = getChild(node, 'body');
    const value = right ? this.evaluate(right, controls) : createValue();
    // `for...in` gives keys, which are strings.
    const item = node.type === 'ForInStatement' ? createValue() : value;
    const inner = [
      ...controls,
      { reads: right ? [toRange(right)] : [], arm: toRange(body ?? node) },
    ];
    const site = right ?? node;
    if (left?.type === 'VariableDeclaration') {
      for (const declarator of getChildren(left, 'declarations')) {
        const id = getChild(declarator, 'id');
        if (!id) {
          continue;
        }
        for (const binding of this.listPatternLocals(id)) {
          this.addSource(binding.id, site);
        }
        this.bindPattern(id, item, site, inner, false);
      }
    } else if (left) {
      this.bindPattern(left, item, site, inner, true);
    }
    if (body) {
      this.walkStatement(body, inner);
    }
  }

  // Expressions

  private evaluateMemberParts(member: AstNode, controls: Control[]): Value {
    const object = getChild(member, 'object');
    const property = getChild(member, 'property');
    const value = object ? this.evaluate(object, controls) : createValue();
    if (member.computed === true && property) {
      this.evaluate(property, controls);
    }
    return value;
  }

  private evaluate(raw: AstNode, controls: Control[]): Value {
    const node = unwrap(raw);
    switch (node.type) {
      case 'Identifier': {
        const binding = this.getLocal(node);
        const value = createValue();
        if (binding && this.fresh.has(binding.id)) {
          value.candidates.add(binding.id);
        }
        return value;
      }
      case 'ArrayExpression':
      case 'ObjectExpression':
        return this.evaluateLiteral(node, controls);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassExpression':
        return this.captureClosure(node);
      case 'JSXElement':
      case 'JSXFragment':
        return this.evaluateJsx(node, controls);
      case 'MemberExpression': {
        const value = this.evaluateMemberParts(node, controls);
        const name = getPropertyName(node);
        return name !== undefined && PRIMITIVE_PROPERTIES.has(name) ? createValue() : value;
      }
      case 'CallExpression':
        return this.evaluateCall(node, controls);
      case 'NewExpression':
        return this.evaluateNew(node, controls);
      case 'TaggedTemplateExpression': {
        const tag = getChild(node, 'tag');
        if (tag) {
          this.evaluate(tag, controls);
        }
        const quasi = getChild(node, 'quasi');
        const values: Value[] = [];
        for (const expression of quasi ? getChildren(quasi, 'expressions') : []) {
          values.push(this.evaluate(expression, controls));
        }
        return this.callUnknown(values, node, controls);
      }
      case 'ConditionalExpression': {
        const test = getChild(node, 'test');
        if (test) {
          this.evaluate(test, controls);
        }
        const reads = test ? [toRange(test)] : [];
        const result = createValue();
        for (const key of ['consequent', 'alternate']) {
          const arm = getChild(node, key);
          if (arm) {
            mergeValues(result, this.evaluate(arm, [...controls, { reads, arm: toRange(arm) }]));
          }
        }
        return result;
      }
      case 'LogicalExpression': {
        const left = getChild(node, 'left');
        const right = getChild(node, 'right');
        const result = left ? this.evaluate(left, controls) : createValue();
        if (left && right) {
          mergeValues(
            result,
            this.evaluate(right, [...controls, { reads: [toRange(left)], arm: toRange(right) }]),
          );
        }
        return result;
      }
      case 'SequenceExpression': {
        let last = createValue();
        for (const expression of getChildren(node, 'expressions')) {
          last = this.evaluate(expression, controls);
        }
        return last;
      }
      case 'AssignmentExpression':
        return this.evaluateAssignment(node, controls);
      case 'UpdateExpression': {
        const argument = getChild(node, 'argument');
        if (argument) {
          this.evaluateTarget(argument, node, controls);
        }
        return createValue();
      }
      case 'UnaryExpression': {
        const argument = getChild(node, 'argument');
        if (
          argument &&
          node.operator === 'delete' &&
          unwrap(argument).type === 'MemberExpression'
        ) {
          this.evaluateTarget(argument, node, controls);
        } else if (argument) {
          this.evaluate(argument, controls);
        }
        return createValue();
      }
      case 'AwaitExpression': {
        const argument = getChild(node, 'argument');
        return argument ? this.evaluate(argument, controls) : createValue();
      }
      default: {
        // Binary, template and other expressions give primitives. Their parts still run.
        for (const child of listChildNodes(node)) {
          this.evaluate(child, controls);
        }
        return createValue();
      }
    }
  }

  /**
   * An array or object literal holds its parts. A spread copy shares the nested values of a
   * fresh source, so the source joins the copy's group, as `slice()` does. A spread of a
   * non-fresh value, such as a prop, has no candidates and joins nothing.
   */
  private evaluateLiteral(node: AstNode, controls: Control[]): Value {
    const result = createValue();
    const parts =
      node.type === 'ArrayExpression'
        ? getChildren(node, 'elements')
        : getChildren(node, 'properties');
    for (const part of parts) {
      if (part.type === 'SpreadElement') {
        const argument = getChild(part, 'argument');
        if (argument) {
          mergeValues(result, this.evaluate(argument, controls));
        }
        continue;
      }
      if (part.type !== 'Property') {
        mergeValues(result, this.evaluate(part, controls));
        continue;
      }
      const key = getChild(part, 'key');
      if (part.computed === true && key) {
        this.evaluate(key, controls);
      }
      const value = getChild(part, 'value');
      if (value) {
        mergeValues(result, this.evaluate(value, controls));
      }
    }
    result.created.push({ range: toRange(node), closure: false });
    return result;
  }

  /**
   * A closure joins every fresh local it reads. A write inside it to a non-fresh local makes
   * that local opaque, since a call during render changes it.
   */
  private captureClosure(node: AstNode): Value {
    const range = toRange(node);
    const result = createValue();
    for (const reference of this.localReferences) {
      if (!isInside(reference.range, range)) {
        continue;
      }
      if (this.fresh.has(reference.binding)) {
        result.candidates.add(reference.binding);
      } else if (reference.write) {
        this.facts.opaque.add(reference.binding);
      }
    }
    result.created.push({ range, closure: true, mutating: this.hasCapturedMutation(node) });
    return result;
  }

  /**
   * True when the closure body changes a captured fresh value: a write, delete, update or
   * non-read method call rooted at a captured fresh local or at a name inside the closure
   * that aliases one, or a call of a local that holds a mutating closure. Objects the closure
   * builds itself, and unknown calls that receive a captured value, do not count.
   */
  private hasCapturedMutation(node: AstNode): boolean {
    return this.scanForMutation(node, new Set());
  }

  /**
   * Walks a function in source order. `aliases` holds names declared inside it that may point
   * into a captured fresh value: from an initializer or assignment rooted at one, a `for...of`
   * over one, or a parameter of a callback method called on one.
   */
  private scanForMutation(node: AstNode, aliases: Set<number>): boolean {
    this.addAliases(node, aliases);
    if (this.isCapturedMutation(node, aliases)) {
      return true;
    }
    for (const child of listChildNodes(node)) {
      if (this.scanForMutation(child, aliases)) {
        return true;
      }
    }
    return false;
  }

  /** True when the member chain or read-method chain is rooted at a fresh local or an alias. */
  private isRootedAtFresh(node: AstNode, aliases: Set<number>): boolean {
    let current = unwrap(node);
    for (;;) {
      let next: AstNode | undefined;
      if (current.type === 'MemberExpression') {
        next = getChild(current, 'object');
      } else if (current.type === 'CallExpression') {
        // `items.filter(f)` holds the same items, so a read method keeps the root.
        const callee = getChild(current, 'callee');
        const inner = callee ? unwrap(callee) : undefined;
        const name = inner?.type === 'MemberExpression' ? getPropertyName(inner) : undefined;
        if (inner && name !== undefined && READ_METHODS.has(name)) {
          next = getChild(inner, 'object');
        }
        if (!next) {
          return false;
        }
      } else {
        break;
      }
      if (!next) {
        return false;
      }
      current = unwrap(next);
    }
    if (current.type !== 'Identifier' || !isIdentifierReference(current)) {
      return false;
    }
    const binding = this.scope.bindingOf(current);
    if (!binding) {
      return false;
    }
    return aliases.has(binding.id) || (this.locals.has(binding.id) && this.fresh.has(binding.id));
  }

  /** Adds the names a pattern, declaration or assignment target declares or writes. */
  private collectDeclared(pattern: AstNode, result: Set<number>): void {
    switch (pattern.type) {
      case 'Identifier': {
        const binding = isIdentifierReference(pattern) ? this.scope.bindingOf(pattern) : undefined;
        if (binding) {
          result.add(binding.id);
        }
        break;
      }
      case 'VariableDeclaration':
        for (const declarator of getChildren(pattern, 'declarations')) {
          const id = getChild(declarator, 'id');
          if (id) {
            this.collectDeclared(id, result);
          }
        }
        break;
      case 'ObjectPattern':
        for (const property of getChildren(pattern, 'properties')) {
          const child = getChild(property, property.type === 'RestElement' ? 'argument' : 'value');
          if (child) {
            this.collectDeclared(child, result);
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of getChildren(pattern, 'elements')) {
          this.collectDeclared(element, result);
        }
        break;
      case 'AssignmentPattern':
      case 'RestElement': {
        const child = getChild(pattern, pattern.type === 'RestElement' ? 'argument' : 'left');
        if (child) {
          this.collectDeclared(child, result);
        }
        break;
      }
      default:
        break;
    }
  }

  private addAliases(node: AstNode, aliases: Set<number>): void {
    switch (node.type) {
      case 'VariableDeclarator': {
        const id = getChild(node, 'id');
        const init = getChild(node, 'init');
        if (id && init && this.isRootedAtFresh(init, aliases)) {
          this.collectDeclared(id, aliases);
        }
        break;
      }
      case 'AssignmentExpression': {
        const left = getChild(node, 'left');
        const right = getChild(node, 'right');
        if (left && right && this.isRootedAtFresh(right, aliases)) {
          this.collectDeclared(unwrap(left), aliases);
        }
        break;
      }
      case 'ForOfStatement': {
        const left = getChild(node, 'left');
        const right = getChild(node, 'right');
        if (left && right && this.isRootedAtFresh(right, aliases)) {
          this.collectDeclared(left, aliases);
        }
        break;
      }
      case 'CallExpression':
        this.addCallbackAliases(node, aliases);
        break;
      default:
        break;
    }
  }

  /** `items.forEach((item) => ...)`: the callback parameters point into `items`. */
  private addCallbackAliases(node: AstNode, aliases: Set<number>): void {
    const callee = getChild(node, 'callee');
    const inner = callee ? unwrap(callee) : undefined;
    if (inner?.type !== 'MemberExpression') {
      return;
    }
    const name = getPropertyName(inner);
    const object = getChild(inner, 'object');
    if (name === undefined || !CALLBACK_METHODS.has(name) || !object) {
      return;
    }
    if (!this.isRootedAtFresh(object, aliases)) {
      return;
    }
    for (const argument of getChildren(node, 'arguments')) {
      if (isFunctionNode(argument)) {
        for (const param of getChildren(argument, 'params')) {
          this.collectDeclared(param, aliases);
        }
      }
    }
  }

  /**
   * `items.forEach(bump)` on a fresh-rooted receiver: a callback that is not an inline
   * function may write through its parameters, so it changes the items.
   */
  private isOpaqueCallback(
    node: AstNode,
    callee: AstNode,
    name: string,
    aliases: Set<number>,
  ): boolean {
    const object = getChild(callee, 'object');
    if (!CALLBACK_METHODS.has(name) || !object || !this.isRootedAtFresh(object, aliases)) {
      return false;
    }
    const first = getChildren(node, 'arguments').at(0);
    const callback = first ? unwrap(first) : undefined;
    return callback !== undefined && !isFunctionNode(callback) && !this.isPureCall(callback);
  }

  private isCapturedMutation(node: AstNode, aliases: Set<number>): boolean {
    let target: AstNode | undefined;
    switch (node.type) {
      case 'AssignmentExpression':
        target = getChild(node, 'left');
        break;
      case 'UpdateExpression':
        target = getChild(node, 'argument');
        break;
      case 'UnaryExpression':
        target = node.operator === 'delete' ? getChild(node, 'argument') : undefined;
        break;
      case 'CallExpression': {
        const rawCallee = getChild(node, 'callee');
        const callee = rawCallee ? unwrap(rawCallee) : undefined;
        if (callee?.type === 'Identifier') {
          const binding = this.getLocal(callee);
          return binding !== undefined && this.holders.has(binding.id);
        }
        if (callee?.type === 'MemberExpression') {
          const name = getPropertyName(callee);
          if (name === undefined || !READ_METHODS.has(name)) {
            target = callee;
          } else if (this.isOpaqueCallback(node, callee, name, aliases)) {
            return true;
          }
        }
        break;
      }
      default:
        return false;
    }
    const member = target ? unwrap(target) : undefined;
    if (member?.type !== 'MemberExpression') {
      return false;
    }
    const object = getChild(member, 'object');
    return object !== undefined && this.isRootedAtFresh(object, aliases);
  }

  /** JSX holds its props and children. Each prop and child leaves render with the element. */
  private evaluateJsx(node: AstNode, controls: Control[]): Value {
    const result = createValue();
    const opening = getChild(node, 'openingElement');
    const parts: AstNode[] = [];
    for (const attribute of opening ? getChildren(opening, 'attributes') : []) {
      const part = getChild(
        attribute,
        attribute.type === 'JSXSpreadAttribute' ? 'argument' : 'value',
      );
      if (part) {
        parts.push(part);
      }
    }
    parts.push(...getChildren(node, 'children'));
    for (const part of parts) {
      const inner =
        part.type === 'JSXExpressionContainer' || part.type === 'JSXSpreadChild'
          ? getChild(part, 'expression')
          : part;
      if (!inner || inner.type === 'JSXEmptyExpression' || inner.type === 'JSXText') {
        continue;
      }
      const value = this.evaluate(inner, controls);
      this.recordEscape(value, inner);
      mergeValues(result, value);
    }
    result.created.push({ range: toRange(node), closure: false });
    return result;
  }

  private evaluateAssignment(node: AstNode, controls: Control[]): Value {
    const left = getChild(node, 'left');
    const right = getChild(node, 'right');
    const value = right ? this.evaluate(right, controls) : createValue();
    if (!left) {
      return value;
    }
    // Arithmetic compound assignments store a primitive. `=` and logical ones store the right side.
    const operator = typeof node.operator === 'string' ? node.operator : '=';
    const stored = operator === '=' || operator.length === 3 ? value : createValue();
    const target = unwrap(left);
    this.bindPattern(target, stored, node, controls, true);
    return value;
  }

  /** Marks the write of an update or delete target, a name or a member. */
  private evaluateTarget(target: AstNode, node: AstNode, controls: Control[]): void {
    const inner = unwrap(target);
    if (inner.type === 'Identifier') {
      const binding = this.getLocal(inner);
      if (binding) {
        this.markMutation(binding, node, controls, true);
      }
      return;
    }
    if (inner.type === 'MemberExpression') {
      this.evaluateMemberParts(inner, controls);
      const root = this.findRootLocal(inner);
      if (root) {
        this.markMutation(root, node, controls, false);
      }
    }
  }

  private isPureCall(callee: AstNode): boolean {
    if (callee.type === 'Identifier' && typeof callee.name === 'string') {
      return PURE_FUNCTIONS.has(callee.name) && this.isGlobal(callee, callee.name);
    }
    if (callee.type !== 'MemberExpression') {
      return false;
    }
    const object = getChild(callee, 'object');
    const name = getPropertyName(callee);
    if (object?.type !== 'Identifier' || typeof object.name !== 'string') {
      return false;
    }
    const methods = PURE_MEMBERS.get(object.name);
    if (methods === undefined || !this.isGlobal(object, object.name)) {
      return false;
    }
    return methods === null || (name !== undefined && methods.has(name));
  }

  private evaluateCall(node: AstNode, controls: Control[]): Value {
    const rawCallee = getChild(node, 'callee');
    const callee = rawCallee ? unwrap(rawCallee) : undefined;
    const args: Value[] = [];
    const argNodes: AstNode[] = [];
    // The callee's object runs before the arguments.
    let receiver = createValue();
    let calleeValue = createValue();
    if (callee?.type === 'MemberExpression') {
      receiver = this.evaluateMemberParts(callee, controls);
    } else if (callee) {
      calleeValue = this.evaluate(callee, controls);
    }
    for (const argument of getChildren(node, 'arguments')) {
      const inner = argument.type === 'SpreadElement' ? getChild(argument, 'argument') : argument;
      if (inner) {
        args.push(this.evaluate(inner, controls));
        argNodes.push(unwrap(inner));
      }
    }
    if (!callee) {
      return createValue();
    }

    // A method on a fresh value: a read method keeps it, any other method mutates it.
    if (callee.type === 'MemberExpression' && receiver.candidates.size > 0) {
      const name = getPropertyName(callee);
      if (name !== undefined && READ_METHODS.has(name)) {
        if (CALLBACK_METHODS.has(name)) {
          this.callCallbacks({ name, args, argNodes, receiver }, node, controls);
        }
        if (PRIMITIVE_METHODS.has(name)) {
          return createValue();
        }
        return this.joinAll([receiver, ...args], node, controls);
      }
      this.mutateAll(receiver.candidates, node, controls);
      return this.joinAll([receiver, ...args], node, controls);
    }

    // Calling a fresh closure mutates what it captures, and it may keep its arguments.
    if (calleeValue.candidates.size > 0) {
      this.mutateAll(calleeValue.candidates, node, controls);
      return this.joinAll([calleeValue, ...args], node, controls);
    }
    // Known globals only read. A callback method on another value calls its callbacks now.
    if (this.isPureCall(callee)) {
      return createValue();
    }
    if (callee.type === 'MemberExpression') {
      const name = getPropertyName(callee);
      const root = this.findRootLocal(callee);
      if (root && name !== undefined && MUTATING_METHODS.has(name)) {
        this.markMutation(root, node, controls, false);
      }
      if (name !== undefined && CALLBACK_METHODS.has(name)) {
        this.callCallbacks({ name, args, argNodes, receiver }, node, controls);
        return this.joinAll(args, node, controls);
      }
    }

    // A hook result is a frozen input, whatever it was given.
    if (isHookCall(node)) {
      this.callUnknown(args, node, controls);
      return createValue();
    }
    return this.callUnknown(args, node, controls);
  }

  /**
   * A callback method calls its callbacks now. The call mutates what a mutating callback
   * captures, and the receiver when a callback writes through its parameters. The initial
   * value of `reduce` is handed to the callback, so the call mutates it.
   */
  private callCallbacks(call: CallbackCall, node: AstNode, controls: Control[]): void {
    for (const [index, value] of call.args.entries()) {
      const isInitial = index === 1 && (call.name === 'reduce' || call.name === 'reduceRight');
      if (isInitial || this.isMutatingValue(value)) {
        this.mutateAll(value.candidates, node, controls);
      }
      if (index === 0 && this.isParameterWriter(call.argNodes[index])) {
        this.mutateAll(call.receiver.candidates, node, controls);
      }
    }
  }

  /**
   * True when a callback may write through its parameters. An inline function is scanned.
   * Any other callback (a local, module function, prop, member or call result) is unknown
   * code that receives the items, so it is assumed to, unless it is a known pure global.
   */
  private isParameterWriter(argument: AstNode | undefined): boolean {
    if (!argument) {
      return false;
    }
    if (isFunctionNode(argument)) {
      const params = new Set<number>();
      for (const param of getChildren(argument, 'params')) {
        this.collectDeclared(param, params);
      }
      return this.scanForMutation(argument, params);
    }
    return !this.isPureCall(argument);
  }

  /** An unknown call mutates every fresh value it receives, may join them, and may keep them. */
  private callUnknown(args: Value[], node: AstNode, controls: Control[]): Value {
    const result = this.joinAll(args, node, controls);
    this.mutateAll(result.candidates, node, controls);
    this.recordEscape(result, node);
    return result;
  }

  private evaluateNew(node: AstNode, controls: Control[]): Value {
    const rawCallee = getChild(node, 'callee');
    const callee = rawCallee ? unwrap(rawCallee) : undefined;
    if (callee) {
      this.evaluate(callee, controls);
    }
    const args: Value[] = [];
    for (const argument of getChildren(node, 'arguments')) {
      const inner = argument.type === 'SpreadElement' ? getChild(argument, 'argument') : argument;
      if (inner) {
        args.push(this.evaluate(inner, controls));
      }
    }
    const known =
      callee?.type === 'Identifier' &&
      typeof callee.name === 'string' &&
      KNOWN_CONSTRUCTORS.has(callee.name) &&
      this.isGlobal(callee, callee.name);
    const result = known
      ? this.joinAll(args, node, controls)
      : this.callUnknown(args, node, controls);
    const value = mergeValues(createValue(), result);
    value.created.push({ range: toRange(node), closure: false });
    return value;
  }
}
