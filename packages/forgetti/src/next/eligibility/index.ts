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
  /** The identifier at the root of the written member chain. */
  root: AstNode;
  /** The right side, or the call arguments. */
  values: AstNode[];
  /** True for `root.current = value`. */
  isCurrent: boolean;
  /** True for `root = value`, which writes the name and not a member. */
  isRebind: boolean;
  /** True inside a closure, which runs later and not during render. */
  nested: boolean;
}

interface HookCall {
  node: AstNode;
  callee: AstNode;
  afterEarlyReturn: boolean;
}

interface Facts {
  mutations: Mutation[];
  hookCalls: HookCall[];
  /** Declarators in source order, outside nested functions. */
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
  const root = findRoot(inner);
  if (!root) {
    return;
  }
  const isRebind = inner.type === 'Identifier';
  let isCurrent = false;
  if (inner.type === 'MemberExpression') {
    const object = getChild(inner, 'object');
    isCurrent = getPropertyName(inner) === 'current' && object?.type === 'Identifier';
  }
  facts.mutations.push({ node, root, values, isCurrent, isRebind, nested });
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
    const facts: Facts = { mutations: [], hookCalls: [], declarators: [], returns: [] };
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
      case 'VariableDeclarator':
        if (!nested) {
          facts.declarators.push(node);
        }
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
      const root = object ? findRoot(object) : undefined;
      if (name !== undefined && MUTATING_METHODS.has(name) && root) {
        facts.mutations.push({
          node,
          root,
          values: getChildren(node, 'arguments'),
          isCurrent: false,
          isRebind: false,
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
      const written = first ? findRoot(first) : undefined;
      if (
        owner?.type === 'Identifier' &&
        owner.name === 'Object' &&
        name !== undefined &&
        OBJECT_WRITERS.has(name) &&
        written
      ) {
        facts.mutations.push({
          node,
          root: written,
          values: rest,
          isCurrent: false,
          isRebind: false,
          nested,
        });
      }
    }
    if (!nested && this.getHookName(target) !== undefined) {
      facts.hookCalls.push({ node, callee: target, afterEarlyReturn });
    }
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

    for (const declarator of facts.declarators) {
      const id = getChild(declarator, 'id');
      const init = getChild(declarator, 'init');
      if (id && init) {
        this.seedDeclarator(id, unwrap(init));
      }
    }
  }

  private seedDeclarator(id: AstNode, value: AstNode): void {
    // `const [value] = useState()` holds state. `const ref = useRef()` holds a ref.
    if (value.type === 'CallExpression') {
      const callee = getChild(value, 'callee');
      const type = callee ? this.getHookType(callee) : undefined;
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
      return;
    }

    // An alias of a watched value, such as `const items = props.items`, is watched too.
    const root = findRoot(value);
    const rootBinding = root ? this.bindingOf(root) : undefined;
    const taint = rootBinding ? this.taints.get(rootBinding) : undefined;
    for (const identifier of listPatternIdentifiers(id)) {
      const binding = this.bindingOf(identifier);
      if (!binding) {
        continue;
      }
      if (taint) {
        this.taints.set(binding, taint);
      } else if (id.type === 'Identifier' && binding.kind === 'const' && this.isFresh(value)) {
        this.freshBindings.add(binding);
      }
    }
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
      const binding = this.bindingOf(mutation.root);
      const taint = binding ? this.taints.get(binding) : undefined;
      // Rebinding a parameter name changes the local, not the caller's value.
      if (taint && binding && !mutation.isRebind) {
        findings.push({
          reason: taint,
          node: mutation.node,
          message: `${subject} mutates ${describeTaint(taint)} through \`${binding.name}\``,
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
        if (mutation.nested && this.bindingOf(mutation.root) === binding) {
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
