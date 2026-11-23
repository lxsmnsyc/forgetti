import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type { BailoutReason, HookType, Preset } from '../index';
import type { Binding, Eligibility, Range, Reference, Unit } from '../ir';
import type { ParseResult } from '../parse';
import { isIdentifierReference } from '../parse/scope';

const MUTATING_METHODS = new Set([
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
]);

/** Methods that return a new array holding the same elements. */
const COPYING_METHODS = new Set([
  'slice',
  'concat',
  'filter',
  'map',
  'flat',
  'flatMap',
  'toSorted',
  'toReversed',
  'toSpliced',
  'with',
]);

/** Methods that return their receiver. */
const RECEIVER_METHODS = new Set(['sort', 'reverse', 'fill', 'copyWithin']);

/** Functions whose result is a new primitive or a new value that holds none of the arguments. */
const FRESH_FUNCTIONS = new Set([
  'String',
  'Number',
  'Boolean',
  'BigInt',
  'Symbol',
  'parseInt',
  'parseFloat',
  'structuredClone',
]);

const FRESH_CONSTRUCTORS = new Set([
  'Date',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'URL',
  'URLSearchParams',
  'Uint8Array',
  'Float32Array',
  'Float64Array',
  'Int32Array',
]);

/** Constructors whose result is a new container that may hold the objects it is given. */
/** Methods of builtin containers that return a stored element and never one of their arguments. */
const ELEMENT_METHODS = new Set(['get', 'at', 'find', 'findLast', 'pop', 'shift']);

const BUILTIN_CONTAINERS = new Set(['Map', 'WeakMap', 'Set', 'WeakSet', 'Array']);

const CONTAINER_CONSTRUCTORS = new Set(['Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Object']);

const OBJECT_WRITERS = new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf']);

const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'ChainExpression',
]);

type Taint = 'mutates-props' | 'mutates-state' | 'mutates-hook-argument';

interface Finding {
  reason: BailoutReason;
  node: AstNode;
  message: string;
}

/** A write through a name: `a.b = x`, `a.b++`, `delete a.b` or `a.push(x)`. */
interface Mutation {
  node: AstNode;
  /** The identifier at the root of the written member chain, when the root is a name. */
  root: AstNode | undefined;
  /** The expression at the root of the written member chain, such as `getBox(p)` in `getBox(p).n = 1`. */
  rootExpr: AstNode;
  /** The right side, or the call arguments. */
  values: AstNode[];
  /** True for `root.current = value`. */
  isCurrent: boolean;
  /** True for `root = value`, which writes the name and not a member. */
  isRebind: boolean;
  /** True when the first member after the root is `.current`, the ref convention. */
  viaCurrent: boolean;
  /** The property closest to the root of the written chain. */
  first: string | undefined;
  /** Member hops between the root and the object that is changed. `copy[0] = y` is 0, `copy[0].x = y` is 1. */
  depth: number;
  /** True inside a closure, which runs later and not during render. */
  nested: boolean;
}

interface HookCall {
  node: AstNode;
  callee: AstNode;
  afterEarlyReturn: boolean;
}

/** A value that may share objects with props, state or a hook result. */
interface Derived {
  taint: Taint;
  /**
   * How far down a write is safe. -1: the value is the shared object itself. 0: the value is a new
   * container that holds shared objects, so only the container may change. 1: the shared objects
   * are one level further down, and so on.
   */
  safe: number;
  /** For an object literal, the same measure for the value of each named field. */
  fields?: Map<string, number>;
}

/** Names that receive the elements of a watched value, through a loop or a callback. */
interface ElementSource {
  pattern: AstNode;
  source: AstNode;
}

interface Facts {
  elementSources: ElementSource[];
  /** Function declarations anywhere in the unit. */
  functions: AstNode[];
  mutations: Mutation[];
  hookCalls: HookCall[];
  /** Declarators in source order, at every depth. */
  declarators: AstNode[];
  /** The values the unit returns, outside nested functions. */
  returns: AstNode[];
}

function isFunctionNode(node: AstNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

function unwrap(node: AstNode): AstNode {
  let current = node;
  for (;;) {
    const inner = getChild(current, 'expression');
    if (!WRAPPERS.has(current.type) || !inner) {
      return current;
    }
    current = inner;
  }
}

/** Returns the identifier at the root of a member chain, or undefined when a call or literal is the root. */
function findRoot(node: AstNode): AstNode | undefined {
  let current = unwrap(node);
  while (current.type === 'MemberExpression') {
    const object = getChild(current, 'object');
    if (!object) {
      return undefined;
    }
    current = unwrap(object);
  }
  return current.type === 'Identifier' ? current : undefined;
}

/** Returns the expression at the root of a member chain: an identifier, a call, a conditional and so on. */
function findRootExpr(node: AstNode): AstNode {
  let current = unwrap(node);
  while (current.type === 'MemberExpression') {
    const object = getChild(current, 'object');
    if (!object) {
      break;
    }
    current = unwrap(object);
  }
  return current;
}

/** Counts the member hops of a chain and names the property closest to the root. */
function describeChain(node: AstNode): { hops: number; first: string | undefined } {
  let hops = 0;
  let first: string | undefined;
  let current = unwrap(node);
  while (current.type === 'MemberExpression') {
    hops += 1;
    first = getPropertyName(current);
    const object = getChild(current, 'object');
    if (!object) {
      break;
    }
    current = unwrap(object);
  }
  return { hops, first };
}

function isMember(node: AstNode): boolean {
  return unwrap(node).type === 'MemberExpression';
}

function getPropertyName(member: AstNode): string | undefined {
  const property = getChild(member, 'property');
  if (member.computed === true || !property) {
    return undefined;
  }
  return typeof property.name === 'string' ? property.name : undefined;
}

function listChildNodes(node: AstNode): AstNode[] {
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

/** Lists the binding identifiers a declaration pattern introduces. */
function listPatternIdentifiers(pattern: AstNode, result: AstNode[] = []): AstNode[] {
  switch (pattern.type) {
    case 'Identifier':
      result.push(pattern);
      break;
    case 'ObjectPattern':
      for (const property of getChildren(pattern, 'properties')) {
        const child = getChild(property, property.type === 'RestElement' ? 'argument' : 'value');
        if (child) {
          listPatternIdentifiers(child, result);
        }
      }
      break;
    case 'ArrayPattern':
      for (const element of getChildren(pattern, 'elements')) {
        listPatternIdentifiers(element, result);
      }
      break;
    case 'AssignmentPattern':
    case 'RestElement': {
      const child = getChild(pattern, pattern.type === 'RestElement' ? 'argument' : 'left');
      if (child) {
        listPatternIdentifiers(child, result);
      }
      break;
    }
    default:
      break;
  }
  return result;
}

function toNode(value: unknown): AstNode {
  if (!isNode(value)) {
    throw new Error('eligibility: expected an ESTree node');
  }
  return value;
}

function toRange(node: AstNode): Range {
  return { start: node.start, end: node.end };
}

function hasReturn(node: AstNode): boolean {
  if (isFunctionNode(node)) {
    return false;
  }
  if (node.type === 'ReturnStatement') {
    return true;
  }
  for (const child of listChildNodes(node)) {
    if (!isFunctionNode(child) && hasReturn(child)) {
      return true;
    }
  }
  return false;
}

/** Object, array, `new`, closure, class or JSX: a value that is new on every render. */
function isFreshLiteral(node: AstNode): boolean {
  switch (node.type) {
    case 'ObjectExpression':
    case 'ArrayExpression':
    case 'NewExpression':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'ClassExpression':
    case 'JSXElement':
    case 'JSXFragment':
      return true;
    default:
      return false;
  }
}

function recordWrite(
  facts: Facts,
  node: AstNode,
  target: AstNode,
  values: AstNode[],
  nested: boolean,
): void {
  const inner = unwrap(target);
  if (inner.type !== 'Identifier' && inner.type !== 'MemberExpression') {
    return;
  }
  const root = findRoot(inner);
  const isRebind = inner.type === 'Identifier';
  let isCurrent = false;
  if (inner.type === 'MemberExpression') {
    const object = getChild(inner, 'object');
    isCurrent = getPropertyName(inner) === 'current' && object?.type === 'Identifier';
  }
  const chain = describeChain(inner);
  facts.mutations.push({
    node,
    root,
    rootExpr: findRootExpr(inner),
    values,
    isCurrent,
    isRebind,
    viaCurrent: chain.first === 'current',
    first: chain.first,
    depth: Math.max(chain.hops - 1, 0),
    nested,
  });
}

/** How far down a write is safe when the key is not known: the fields count too. */
function wholeSafe(derived: Derived): number {
  let safe = derived.safe;
  for (const field of derived.fields?.values() ?? []) {
    safe = Math.min(safe, field + 1);
  }
  return safe;
}

/** The value read from a derived value by a member access, with a static key when there is one. */
function readElement(derived: Derived, key: string | undefined): Derived {
  const field = key === undefined ? undefined : derived.fields?.get(key);
  if (field !== undefined) {
    return { taint: derived.taint, safe: field };
  }
  const safe = key === undefined ? wholeSafe(derived) : derived.safe;
  return { taint: derived.taint, safe: safe <= 0 ? -1 : safe - 1 };
}

/** True when a write reaches an object the copy shares with its source. */
function isSharedDepth(copy: Derived, mutation: Mutation): boolean {
  if (mutation.depth === 0) {
    return false;
  }
  const field = mutation.first === undefined ? undefined : copy.fields?.get(mutation.first);
  if (field !== undefined) {
    return mutation.depth - 1 > field;
  }
  return mutation.depth > (mutation.first === undefined ? wholeSafe(copy) : copy.safe);
}

function describeTaint(taint: Taint): string {
  if (taint === 'mutates-state') {
    return 'state';
  }
  return taint === 'mutates-props' ? 'props' : 'a hook argument';
}

class UnitChecker {
  private readonly refByNode = new Map<AstNode, Reference>();

  private readonly taints = new Map<Binding, Taint>();

  private readonly refBindings = new Set<Binding>();

  /** Results of hooks other than refs. A `.current` write on them is the ref convention. */
  private readonly hookResults = new Set<Binding>();

  /** Shallow copies by spread. Their own elements may change, what is below them may not. */
  private readonly copies = new Map<Binding, Derived>();

  /** Locals created as a builtin container: an array literal or `new Map/Set/Array(...)`. */
  private readonly containers = new Set<Binding>();

  /** Local functions by name, so a call can be checked against what the body mentions. */
  private readonly localFunctions = new Map<Binding, AstNode[]>();

  private readonly freshBindings = new Set<Binding>();

  private readonly hookPattern: RegExp;

  constructor(
    private readonly scope: ParseResult,
    private readonly preset: Preset,
  ) {
    const raw = preset.filters.hook ?? { source: '^use[A-Z0-9]', flags: '' };
    this.hookPattern = new RegExp(raw.source, raw.flags);
    for (const binding of scope.bindings) {
      for (const reference of binding.references) {
        this.refByNode.set(toNode(reference.node), reference);
      }
    }
    for (const reference of scope.globals) {
      this.refByNode.set(toNode(reference.node), reference);
    }
  }

  check(unit: Unit): Eligibility {
    // Each unit starts clean, so a nested unit never sees its parent's names.
    this.taints.clear();
    this.refBindings.clear();
    this.hookResults.clear();
    this.copies.clear();
    this.containers.clear();
    this.localFunctions.clear();
    this.freshBindings.clear();
    const node = toNode(unit.node);
    const facts = this.collect(node);
    this.seed(unit, node, facts);

    const findings: Finding[] = [
      ...this.findMutations(unit, facts),
      ...this.findHookReturns(unit, facts),
      ...this.findConditionalHooks(unit, facts),
    ];
    findings.sort((a, b) => a.node.start - b.node.start);
    const first = findings.at(0);
    if (!first) {
      return { unit: unit.id, ok: true };
    }
    return {
      unit: unit.id,
      ok: false,
      reason: first.reason,
      range: toRange(first.node),
      message: first.message,
    };
  }

  private bindingOf(node: AstNode): Binding | undefined {
    return isIdentifierReference(node) ? this.scope.bindingOf(node) : undefined;
  }

  /** Walks the unit once and records the facts every rule needs. */
  private collect(unit: AstNode): Facts {
    const facts: Facts = {
      elementSources: [],
      functions: [],
      mutations: [],
      hookCalls: [],
      declarators: [],
      returns: [],
    };
    const body = getChild(unit, 'body');
    if (!body) {
      return facts;
    }
    if (body.type !== 'BlockStatement') {
      // An arrow function with an expression body returns it.
      facts.returns.push(body);
      this.visit(body, facts, 0, false);
      return facts;
    }

    // Hooks after a statement that may return early are conditional.
    let afterEarlyReturn = false;
    for (const statement of getChildren(body, 'body')) {
      // A function declaration is a closure: its body does not run during render.
      this.visit(statement, facts, isFunctionNode(statement) ? 1 : 0, afterEarlyReturn);
      if (statement.type !== 'ReturnStatement' && hasReturn(statement)) {
        afterEarlyReturn = true;
      }
    }
    return facts;
  }

  private visit(node: AstNode, facts: Facts, depth: number, afterEarlyReturn: boolean): void {
    const nested = depth > 0;
    switch (node.type) {
      case 'FunctionDeclaration':
        facts.functions.push(node);
        break;
      case 'VariableDeclarator':
        // Locals of handlers and callbacks are classified too. Names resolve by binding.
        facts.declarators.push(node);
        break;
      case 'ReturnStatement': {
        const argument = getChild(node, 'argument');
        if (argument && !nested) {
          facts.returns.push(argument);
        }
        break;
      }
      case 'AssignmentExpression': {
        const left = getChild(node, 'left');
        const right = getChild(node, 'right');
        if (left && right) {
          recordWrite(facts, node, left, [right], nested);
        }
        break;
      }
      case 'UpdateExpression': {
        const argument = getChild(node, 'argument');
        if (argument && isMember(argument)) {
          recordWrite(facts, node, argument, [], nested);
        }
        break;
      }
      case 'UnaryExpression': {
        const argument = getChild(node, 'argument');
        if (node.operator === 'delete' && argument && isMember(argument)) {
          recordWrite(facts, node, argument, [], nested);
        }
        break;
      }
      case 'ForOfStatement': {
        const left = getChild(node, 'left');
        const right = getChild(node, 'right');
        const declared =
          left?.type === 'VariableDeclaration'
            ? getChildren(left, 'declarations').at(0)
            : undefined;
        const pattern = declared ? getChild(declared, 'id') : left;
        if (pattern && right) {
          facts.elementSources.push({ pattern, source: right });
        }
        break;
      }
      case 'CallExpression':
        this.recordCall(facts, node, nested, afterEarlyReturn);
        break;
      default:
        break;
    }

    for (const child of listChildNodes(node)) {
      this.visit(child, facts, isFunctionNode(child) ? depth + 1 : depth, afterEarlyReturn);
    }
  }

  private recordCall(
    facts: Facts,
    node: AstNode,
    nested: boolean,
    afterEarlyReturn: boolean,
  ): void {
    const callee = getChild(node, 'callee');
    if (!callee) {
      return;
    }
    const target = unwrap(callee);
    // A mutating method called on a member chain, such as `props.items.push(x)`.
    if (target.type === 'MemberExpression') {
      const name = getPropertyName(target);
      const object = getChild(target, 'object');
      if (name !== undefined && MUTATING_METHODS.has(name) && object) {
        const chain = describeChain(object);
        facts.mutations.push({
          node,
          root: findRoot(object),
          rootExpr: findRootExpr(object),
          values: getChildren(node, 'arguments'),
          isCurrent: false,
          isRebind: false,
          viaCurrent: chain.first === 'current',
          first: chain.first,
          depth: chain.hops,
          nested,
        });
      }
    }
    // `Object.assign(target, ...)` and `Object.defineProperty(target, ...)` write to their first argument.
    if (target.type === 'MemberExpression') {
      const owner = getChild(target, 'object');
      const name = getPropertyName(target);
      const args = getChildren(node, 'arguments');
      const first = args.at(0);
      const rest = args.slice(1);
      if (
        owner?.type === 'Identifier' &&
        owner.name === 'Object' &&
        name !== undefined &&
        OBJECT_WRITERS.has(name) &&
        first
      ) {
        const chain = describeChain(first);
        facts.mutations.push({
          node,
          root: findRoot(first),
          rootExpr: findRootExpr(first),
          values: rest,
          isCurrent: false,
          isRebind: false,
          viaCurrent: chain.first === 'current',
          first: chain.first,
          depth: chain.hops,
          nested,
        });
      }
    }
    // `items.forEach((item) => ...)` hands the elements of `items` to the callback.
    if (target.type === 'MemberExpression') {
      const receiver = getChild(target, 'object');
      const args = getChildren(node, 'arguments');
      const method = getPropertyName(target);
      const isReduce = method === 'reduce' || method === 'reduceRight';
      for (const arg of args) {
        if (receiver && isFunctionNode(arg)) {
          const params = getChildren(arg, 'params');
          for (const [index, param] of params.entries()) {
            // The accumulator of a reduce holds the initial value, which is the receiver only when missing.
            const isAccumulator = isReduce && index === 0;
            const source = isAccumulator ? (args.at(1) ?? receiver) : receiver;
            facts.elementSources.push({ pattern: param, source });
          }
        }
      }
    }
    if (!nested && this.getHookName(target) !== undefined) {
      facts.hookCalls.push({ node, callee: target, afterEarlyReturn });
    }
  }

  /** True for a name with no local binding, such as the global `JSON`. A local `JSON` is user code. */
  private isGlobal(node: AstNode | undefined, name: string): boolean {
    return node?.type === 'Identifier' && node.name === name && this.bindingOf(node) === undefined;
  }

  private isGlobalIn(node: AstNode | undefined, names: Set<string>): boolean {
    return (
      node?.type === 'Identifier' &&
      typeof node.name === 'string' &&
      names.has(node.name) &&
      this.bindingOf(node) === undefined
    );
  }

  /** Calls that return a new container holding the same elements. */
  private isCopyCall(call: AstNode): boolean {
    const callee = getChild(call, 'callee');
    const target = callee ? unwrap(callee) : undefined;
    if (target?.type !== 'MemberExpression') {
      return false;
    }
    const name = getPropertyName(target);
    const owner = getChild(target, 'object');
    if (this.isGlobal(owner, 'Object')) {
      const first = getChildren(call, 'arguments').at(0);
      if (name === 'assign') {
        return (
          first !== undefined &&
          (first.type === 'ObjectExpression' || first.type === 'ArrayExpression')
        );
      }
      return name === 'values' || name === 'entries' || name === 'keys' || name === 'fromEntries';
    }
    if (this.isGlobal(owner, 'Array')) {
      return name === 'from';
    }
    return name !== undefined && COPYING_METHODS.has(name);
  }

  /** Calls whose result never holds the objects of their arguments. */
  private isFreshCall(target: AstNode): boolean {
    if (target.type === 'Identifier') {
      return this.isGlobalIn(target, FRESH_FUNCTIONS);
    }
    if (target.type !== 'MemberExpression') {
      return false;
    }
    const name = getPropertyName(target);
    const owner = getChild(target, 'object');
    if (name === 'split') {
      return true;
    }
    if (this.isGlobal(owner, 'JSON')) {
      return name === 'parse' || name === 'stringify';
    }
    return this.isGlobal(owner, 'Object') && name === 'create';
  }

  /** The name of a callee that looks like a hook: `useX()` or `React.useX()`. */
  private getHookName(callee: AstNode): string | undefined {
    let name: string | undefined;
    if (callee.type === 'Identifier' && typeof callee.name === 'string') {
      name = callee.name;
    } else if (callee.type === 'MemberExpression') {
      name = getPropertyName(callee);
    }
    return name !== undefined && this.hookPattern.test(name) ? name : undefined;
  }

  /** The preset type of the hook a callee names, found through its import. */
  private getHookType(callee: AstNode): HookType | undefined {
    const target = unwrap(callee);
    let imported: Binding['imported'];
    let name: string | undefined;
    if (target.type === 'Identifier') {
      imported = this.bindingOf(target)?.imported;
      name = imported?.name;
    } else if (target.type === 'MemberExpression') {
      const object = getChild(target, 'object');
      const found = object?.type === 'Identifier' ? this.bindingOf(object)?.imported : undefined;
      if (found && (found.name === '*' || found.name === 'default')) {
        imported = found;
        name = getPropertyName(target);
      }
    }
    if (!imported || name === undefined) {
      return undefined;
    }
    for (const hook of this.preset.imports.hooks) {
      if (hook.source !== imported.source) {
        continue;
      }
      if ((hook.kind === 'named' ? hook.name : 'default') === name) {
        return hook.type;
      }
    }
    return undefined;
  }

  /** Marks what props, state and hook arguments reach, and which names hold refs and fresh values. */
  private seed(unit: Unit, node: AstNode, facts: Facts): void {
    const params = getChildren(node, 'params');
    const watched = unit.kind === 'hook' ? params : params.slice(0, 1);
    const reason: Taint = unit.kind === 'hook' ? 'mutates-hook-argument' : 'mutates-props';
    for (const param of watched) {
      for (const identifier of listPatternIdentifiers(param)) {
        const binding = this.bindingOf(identifier);
        if (binding) {
          this.taints.set(binding, reason);
        }
      }
    }

    for (const declaration of facts.functions) {
      const id = getChild(declaration, 'id');
      const binding = id ? this.bindingOf(id) : undefined;
      if (binding) {
        this.addLocalFunction(binding, declaration);
      }
    }

    // Derived values can feed each other in any source order, so a few passes settle them.
    for (let pass = 0; pass < 4; pass += 1) {
      for (const declarator of facts.declarators) {
        const id = getChild(declarator, 'id');
        const init = getChild(declarator, 'init');
        if (id && init) {
          this.seedAssignment(id, unwrap(init));
        }
      }
      // A later `c = [...props.items]` makes `c` derived too.
      for (const mutation of facts.mutations) {
        const value = mutation.values.at(0);
        if (mutation.isRebind && value && mutation.root) {
          this.seedAssignment(mutation.root, unwrap(value));
        }
      }
      // `o.a = p.box`, `list.push(item)` and `map.set(k, p.box)` make the container hold shared objects.
      for (const mutation of facts.mutations) {
        this.seedStore(mutation);
      }
      // `for (const i of copy)` and `copy.forEach((i) => ...)` hand out the elements.
      for (const entry of facts.elementSources) {
        const derived = this.findDerived(entry.source);
        if (derived) {
          this.taintPattern(entry.pattern, { taint: derived.taint, safe: -1 });
        }
      }
    }
  }

  /**
   * A watched value written into a member of a local makes that member watched with the same
   * source: per field for a static name, for the whole object otherwise. A target such as
   * `(g[k] ||= []).push(x)` or `m.get(k).push(x)` resolves to the local it reads from.
   */
  private seedStore(mutation: Mutation): void {
    if (mutation.isRebind) {
      return;
    }
    let root = mutation.root;
    let depth = mutation.depth;
    let first = mutation.first;
    if (!root) {
      const expr = unwrap(mutation.rootExpr);
      if (expr.type === 'AssignmentExpression') {
        const left = getChild(expr, 'left');
        const written = left ? unwrap(left) : undefined;
        root = written ? findRoot(written) : undefined;
        if (written && root) {
          const chain = describeChain(written);
          depth += chain.hops;
          first = chain.hops > 0 ? chain.first : first;
        }
      } else if (expr.type === 'CallExpression') {
        const callee = getChild(expr, 'callee');
        const target = callee ? unwrap(callee) : undefined;
        const object = target?.type === 'MemberExpression' ? getChild(target, 'object') : undefined;
        const name = target ? getPropertyName(target) : undefined;
        if (object?.type === 'Identifier' && name !== undefined && ELEMENT_METHODS.has(name)) {
          if (this.isContainer(object)) {
            root = object;
            depth += 1;
            first = undefined;
          }
        }
      }
    }
    const binding = root ? this.bindingOf(root) : undefined;
    if (!binding || this.taints.has(binding)) {
      return;
    }
    // `map.set(key, value)` stores the value only.
    let values = mutation.values;
    const call = mutation.node;
    const callee = call.type === 'CallExpression' ? getChild(call, 'callee') : undefined;
    if (callee && this.isContainer(root) && getPropertyName(unwrap(callee)) === 'set') {
      values = values.slice(1);
    }
    let found: Derived | undefined;
    for (const value of values) {
      const derived = this.findDerived(value);
      if (derived && (!found || derived.safe < found.safe)) {
        found = derived;
      }
    }
    if (!found) {
      return;
    }
    // The changed object sits `depth` hops below the local and holds the stored value.
    const current = this.copies.get(binding);
    const next: Derived = {
      taint: current?.taint ?? found.taint,
      safe: current?.safe ?? Number.POSITIVE_INFINITY,
      fields: new Map(current?.fields),
    };
    if (first === undefined) {
      next.safe = Math.min(next.safe, found.safe + depth + 1);
    } else {
      const known = next.fields?.get(first) ?? Number.POSITIVE_INFINITY;
      next.fields?.set(first, Math.min(known, found.safe + depth));
    }
    this.copies.set(binding, next);
  }

  private seedAssignment(id: AstNode, value: AstNode): void {
    if (id.type === 'Identifier') {
      const callee = value.type === 'NewExpression' ? getChild(value, 'callee') : undefined;
      if (value.type === 'ArrayExpression' || this.isGlobalIn(callee, BUILTIN_CONTAINERS)) {
        const binding = this.bindingOf(id);
        if (binding) {
          this.containers.add(binding);
        }
      }
    }
    if (isFunctionNode(value) && id.type === 'Identifier') {
      const binding = this.bindingOf(id);
      if (binding) {
        this.addLocalFunction(binding, value);
      }
    }
    // `const [value] = useState()` holds state. `const ref = useRef()` holds a ref.
    if (value.type === 'CallExpression') {
      const callee = getChild(value, 'callee');
      const type = callee ? this.getHookType(callee) : undefined;
      const isHook = callee !== undefined && this.getHookName(unwrap(callee)) !== undefined;
      if (type === 'state' && id.type === 'ArrayPattern') {
        const first = getChildren(id, 'elements').at(0);
        const identifier = first ? listPatternIdentifiers(first).at(0) : undefined;
        const binding = identifier ? this.bindingOf(identifier) : undefined;
        if (binding) {
          this.taints.set(binding, 'mutates-state');
        }
      }
      if (type === 'ref' && id.type === 'Identifier') {
        const binding = this.bindingOf(id);
        if (binding) {
          this.refBindings.add(binding);
        }
      }
      // Any other hook result is held outside the render, like props.
      if (type !== 'ref' && type !== 'state' && type !== 'effect' && isHook) {
        this.watchHookResult(id);
      }
      if (type !== undefined || isHook) {
        return;
      }
    }

    const derived = this.findDerived(value);
    if (derived) {
      this.taintPattern(id, derived);
      if (derived.safe < 0) {
        return;
      }
    }
    for (const identifier of listPatternIdentifiers(id)) {
      const binding = this.bindingOf(identifier);
      if (binding && id.type === 'Identifier' && binding.kind === 'const' && this.isFresh(value)) {
        this.freshBindings.add(binding);
      }
    }
  }

  /**
   * Marks the names a pattern introduces. A shallow derived value bound to one name is a copy.
   * Names taken apart from it hold its elements, which are shared with the source.
   */
  private taintPattern(id: AstNode, derived: Derived): void {
    for (const identifier of listPatternIdentifiers(id)) {
      const binding = this.bindingOf(identifier);
      if (!binding) {
        continue;
      }
      if (derived.safe < 0 || id.type !== 'Identifier') {
        this.taints.set(binding, derived.taint);
      } else if (!this.taints.has(binding)) {
        this.copies.set(binding, derived);
      }
    }
  }

  private watchHookResult(id: AstNode): void {
    for (const identifier of listPatternIdentifiers(id)) {
      const binding = this.bindingOf(identifier);
      if (binding) {
        this.taints.set(binding, 'mutates-state');
        this.hookResults.add(binding);
      }
    }
  }

  /**
   * Decides whether a value may share objects with props, state or a hook result. The rule is
   * conservative: any expression that mentions a watched name counts, except a literal or a known
   * copying call, which share only the elements. Functions are not entered.
   */
  private findDerived(node: AstNode, depth = 0): Derived | undefined {
    const value = unwrap(node);
    if (depth > 8) {
      return undefined;
    }
    switch (value.type) {
      case 'Identifier': {
        const binding = this.bindingOf(value);
        const taint = binding ? this.taints.get(binding) : undefined;
        if (taint) {
          return { taint, safe: -1 };
        }
        return binding ? this.copies.get(binding) : undefined;
      }
      case 'MemberExpression': {
        // An element of a derived value. The key never ends up in the result.
        const object = getChild(value, 'object');
        const found = object ? this.findDerived(object, depth + 1) : undefined;
        return found ? readElement(found, getPropertyName(value)) : undefined;
      }
      case 'AssignmentExpression': {
        // `a ||= []` gives the old value or the new one. `a = b` gives `b`.
        const operator = value.operator;
        if (operator === '=') {
          const right = getChild(value, 'right');
          return right ? this.findDerived(right, depth + 1) : undefined;
        }
        if (operator === '||=' || operator === '&&=' || operator === '??=') {
          return this.mergeDerived(value, ['left', 'right'], depth);
        }
        return undefined;
      }
      case 'ConditionalExpression':
        return this.mergeDerived(value, ['consequent', 'alternate'], depth);
      case 'LogicalExpression':
        return this.mergeDerived(value, ['left', 'right'], depth);
      case 'SequenceExpression': {
        const last = getChildren(value, 'expressions').at(-1);
        return last ? this.findDerived(last, depth + 1) : undefined;
      }
      case 'ArrayExpression':
      case 'ObjectExpression':
        return this.findLiteralDerived(value, depth);
      case 'CallExpression':
        return this.findCallDerived(value, depth);
      case 'NewExpression': {
        const taint = this.scanWatched(value, true);
        const callee = getChild(value, 'callee');
        if (!taint || this.isGlobalIn(callee, FRESH_CONSTRUCTORS)) {
          return undefined;
        }
        return { taint, safe: this.isGlobalIn(callee, CONTAINER_CONSTRUCTORS) ? 0 : -1 };
      }
      default: {
        const taint = this.scanWatched(value);
        return taint ? { taint, safe: -1 } : undefined;
      }
    }
  }

  /**
   * A call. Known fresh results are not derived, known copying calls are copies, and a method that
   * returns its receiver gives back the receiver's class. Every other call that mentions a watched
   * name, or that runs a local function whose body mentions one, may return the shared object.
   */
  private findCallDerived(call: AstNode, depth: number): Derived | undefined {
    const callee = getChild(call, 'callee');
    const target = callee ? unwrap(callee) : undefined;
    if (!target || this.isFreshCall(target)) {
      return undefined;
    }
    if (target.type === 'MemberExpression') {
      const name = getPropertyName(target);
      const object = getChild(target, 'object');
      const receiver = object ? this.findDerived(object, depth + 1) : undefined;
      // `map.get(key)` returns what was stored in a builtin container, not the key.
      if (name !== undefined && ELEMENT_METHODS.has(name) && this.isContainer(object)) {
        return receiver ? readElement(receiver, undefined) : undefined;
      }
      if (receiver && name !== undefined && RECEIVER_METHODS.has(name)) {
        return receiver;
      }
      if (receiver && (name === 'reduce' || name === 'reduceRight')) {
        const args = getChildren(call, 'arguments');
        if (args.length < 2) {
          return { taint: receiver.taint, safe: -1 };
        }
        // A new accumulator may collect the elements.
        return this.findDerived(args[1], depth + 1) ?? { taint: receiver.taint, safe: 0 };
      }
    }
    // Function arguments are entered: `run(() => p.box)` may return the prop.
    const taint = this.scanWatched(call, true);
    if (taint && this.isCopyCall(call)) {
      return { taint, safe: 0 };
    }
    const closed = taint ?? this.findClosureTaint(target);
    return closed ? { taint: closed, safe: -1 } : undefined;
  }

  private isContainer(node: AstNode | undefined): boolean {
    const binding = node?.type === 'Identifier' ? this.bindingOf(node) : undefined;
    return binding !== undefined && this.containers.has(binding) && !this.taints.has(binding);
  }

  private addLocalFunction(binding: Binding, fn: AstNode): void {
    const list = this.localFunctions.get(binding) ?? [];
    if (!list.includes(fn)) {
      list.push(fn);
    }
    this.localFunctions.set(binding, list);
  }

  /** The taint a called function mentions in its body. A local function may hold any body assigned to it. */
  private findClosureTaint(target: AstNode): Taint | undefined {
    let functions: AstNode[] = [];
    if (isFunctionNode(target)) {
      functions = [target];
    } else if (target.type === 'Identifier') {
      const binding = this.bindingOf(target);
      functions = (binding ? this.localFunctions.get(binding) : undefined) ?? [];
    }
    for (const fn of functions) {
      const found = this.scanWatched(fn, true);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** An array or object literal. Each member says how far down the literal stays safe to change. */
  private findLiteralDerived(node: AstNode, depth: number): Derived | undefined {
    const isArray = node.type === 'ArrayExpression';
    let taint: Taint | undefined;
    let safe = Number.POSITIVE_INFINITY;
    const fields = new Map<string, number>();
    for (const member of getChildren(node, isArray ? 'elements' : 'properties')) {
      if (member.type === 'SpreadElement') {
        // The elements of the spread value are the shared objects.
        const argument = getChild(member, 'argument');
        const found = argument ? this.findDerived(argument, depth + 1) : undefined;
        if (found) {
          taint ??= found.taint;
          safe = Math.min(safe, Math.max(found.safe, 0));
        }
        continue;
      }
      const child = isArray ? member : getChild(member, 'value');
      let found = child ? this.findDerived(child, depth + 1) : undefined;
      // A function member that closes over a watched name may return it when called.
      const closed = child && isFunctionNode(child) ? this.scanWatched(child, true) : undefined;
      if (!found && closed) {
        found = { taint: closed, safe: -1 };
      }
      if (!found) {
        continue;
      }
      taint ??= found.taint;
      safe = Math.min(safe, found.safe + 1);
      const key = isArray ? undefined : getChild(member, 'key');
      if (key?.type === 'Identifier' && member.computed !== true && typeof key.name === 'string') {
        fields.set(key.name, found.safe);
      }
    }
    return taint ? { taint, safe, fields } : undefined;
  }

  private mergeDerived(node: AstNode, keys: string[], depth: number): Derived | undefined {
    let result: Derived | undefined;
    for (const key of keys) {
      const child = getChild(node, key);
      const found = child ? this.findDerived(child, depth + 1) : undefined;
      if (found && (!result || found.safe < result.safe)) {
        result = found;
      }
    }
    return result;
  }

  /** The taint of the first watched name the expression mentions, outside nested functions. */
  private scanWatched(node: AstNode, enterFunctions = false): Taint | undefined {
    if (!enterFunctions && isFunctionNode(node)) {
      return undefined;
    }
    if (node.type === 'Identifier') {
      const binding = this.bindingOf(node);
      return binding ? (this.taints.get(binding) ?? this.copies.get(binding)?.taint) : undefined;
    }
    for (const child of listChildNodes(node)) {
      const found = this.scanWatched(child, enterFunctions);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  /** A fresh value is a literal, closure or JSX created in this render, or a const that holds one. */
  private isFresh(node: AstNode, depth = 0): boolean {
    const value = unwrap(node);
    if (depth > 8) {
      return false;
    }
    switch (value.type) {
      case 'Identifier': {
        const binding = this.bindingOf(value);
        return binding !== undefined && this.freshBindings.has(binding);
      }
      case 'ConditionalExpression':
        return this.isAnyFresh(value, ['consequent', 'alternate'], depth);
      case 'LogicalExpression':
        return this.isAnyFresh(value, ['left', 'right'], depth);
      case 'SequenceExpression': {
        const last = getChildren(value, 'expressions').at(-1);
        return last !== undefined && this.isFresh(last, depth + 1);
      }
      default:
        return isFreshLiteral(value);
    }
  }

  private isAnyFresh(node: AstNode, keys: string[], depth: number): boolean {
    for (const key of keys) {
      const child = getChild(node, key);
      if (child && this.isFresh(child, depth + 1)) {
        return true;
      }
    }
    return false;
  }

  private findMutations(unit: Unit, facts: Facts): Finding[] {
    const findings: Finding[] = [];
    const subject = `${unit.kind} ${unit.name}`;
    for (const mutation of facts.mutations) {
      // The write starts at an expression, such as `getBox(p).n = 1`.
      if (!mutation.root) {
        const found = this.findDerived(mutation.rootExpr);
        if (found && (found.safe < 0 || isSharedDepth(found, mutation))) {
          findings.push({
            reason: found.taint,
            node: mutation.node,
            message: `${subject} mutates ${describeTaint(found.taint)} through an expression that may return a shared object`,
          });
        }
        continue;
      }
      const binding = this.bindingOf(mutation.root);
      const taint = binding ? this.taints.get(binding) : undefined;
      // Writes to `.current` of a hook result follow the ref convention.
      const isRefWrite =
        binding !== undefined && this.hookResults.has(binding) && mutation.viaCurrent;
      // Rebinding a parameter name changes the local, not the caller's value.
      if (taint && binding && !mutation.isRebind && !isRefWrite) {
        findings.push({
          reason: taint,
          node: mutation.node,
          message: `${subject} mutates ${describeTaint(taint)} through \`${binding.name}\``,
        });
        continue;
      }
      // A write below a spread copy reaches an element of the source.
      const copy = binding ? this.copies.get(binding) : undefined;
      if (copy && binding && !mutation.isRebind && isSharedDepth(copy, mutation)) {
        findings.push({
          reason: copy.taint,
          node: mutation.node,
          message: `${subject} mutates ${describeTaint(copy.taint)} through \`${binding.name}\`, which shares objects with it`,
        });
        continue;
      }

      // A closure runs later, so it may store fresh values in refs and module state.
      if (mutation.nested || !this.hasFreshValue(mutation.values)) {
        continue;
      }
      if (mutation.isCurrent && binding && this.refBindings.has(binding)) {
        findings.push({
          reason: 'stores-fresh-in-ref',
          node: mutation.node,
          message: `${subject} stores a value created in this render in \`${binding.name}.current\``,
        });
      } else if (this.isModuleName(mutation.root, binding)) {
        findings.push({
          reason: 'stores-fresh-in-module',
          node: mutation.node,
          message: `${subject} stores a value created in this render in \`${String(mutation.root.name)}\`, which outlives the render`,
        });
      }
    }
    return findings;
  }

  private hasFreshValue(values: AstNode[]): boolean {
    for (const value of values) {
      if (this.isFresh(value)) {
        return true;
      }
    }
    return false;
  }

  /** A module-level name or a global, both of which outlive one render. */
  private isModuleName(root: AstNode, binding: Binding | undefined): boolean {
    if (!binding) {
      return this.refByNode.has(root);
    }
    return binding.scope === 0 && binding.kind !== 'import';
  }

  private findHookReturns(unit: Unit, facts: Facts): Finding[] {
    const findings: Finding[] = [];
    if (unit.kind !== 'hook') {
      return findings;
    }
    // A returned fresh value that a closure changes later is shared by every render of a cached hook.
    for (const returned of facts.returns) {
      const value = unwrap(returned);
      const binding = value.type === 'Identifier' ? this.bindingOf(value) : undefined;
      if (!binding || !this.freshBindings.has(binding)) {
        continue;
      }
      for (const mutation of facts.mutations) {
        if (mutation.nested && mutation.root && this.bindingOf(mutation.root) === binding) {
          findings.push({
            reason: 'returns-fresh-from-hook',
            node: returned,
            message: `hook ${unit.name} returns \`${binding.name}\`, created in this render and changed later by a closure`,
          });
          break;
        }
      }
    }
    return findings;
  }

  private findConditionalHooks(unit: Unit, facts: Facts): Finding[] {
    const findings: Finding[] = [];
    for (const call of facts.hookCalls) {
      // `use()` may run in a branch or a loop.
      if (this.getHookType(call.callee) === 'use') {
        continue;
      }
      const root = findRoot(call.callee);
      const reference = root ? this.refByNode.get(root) : undefined;
      const inBranch = reference ? this.isInBranchOrLoop(reference.scope, unit) : false;
      if (inBranch || call.afterEarlyReturn) {
        const name = this.getHookName(call.callee) ?? 'hook';
        findings.push({
          reason: 'conditional-hook',
          node: call.node,
          message: `${name} is called ${inBranch ? 'in a branch or loop' : 'after an early return'}, so the hook order can change between renders`,
        });
      }
    }
    return findings;
  }

  /** Walks the scope chain from `id` up to the unit scope and reports a branch or loop on the way. */
  private isInBranchOrLoop(id: number, unit: Unit): boolean {
    const { start, end } = unit.node;
    for (
      let current: number | null = id;
      current !== null;
      current = this.scope.scopes[current].parent
    ) {
      const scope = this.scope.scopes[current];
      if (scope.kind === 'unit' && scope.range.start === start && scope.range.end === end) {
        return false;
      }
      if (scope.kind === 'branch' || scope.kind === 'loop') {
        return true;
      }
    }
    return false;
  }
}

/**
 * Phase 2: decides per unit whether it can be compiled. The first problem in source order
 * is the answer. Closures are not checked for mutations, because they run later and not
 * during render. The escaping-closure trigger needs ownership groups and is left to phase 3.
 */
export function checkEligibility(scope: ParseResult, preset: Preset): Eligibility[] {
  const checker = new UnitChecker(scope, preset);
  const results: Eligibility[] = [];
  for (const unit of scope.units) {
    results.push(checker.check(unit));
  }
  return results;
}
