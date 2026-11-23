import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type {
  Binding,
  CachePlan,
  Group,
  OwnershipResult,
  Range,
  Reference,
  ScopeResult,
  SlotBlock,
  ValueRef,
} from '../ir';
import type { Context, UnitRef } from './baseline';
import {
  HOOK_NAME,
  IMPURE_MEMBERS,
  STABLE_GLOBALS,
  createContext,
  createLocal,
  findDeferred,
  findInitializer,
  getCalleeName,
  getMemberName,
  getRange,
  isAssignedReadOnly,
  isElement,
  isInside,
  isPlainInput,
  isPureSyntax,
  isReadOnlyUse,
  isResultReadOnly,
  isStableOuter,
  pushChildren,
  walkNodes,
} from './baseline';
import { isCheap } from './cost';

const FRESH_LITERALS = new Set([
  'ObjectExpression',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'NewExpression',
]);

const LOOPS = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const IMPURE_SYNTAX = new Set([
  'ThisExpression',
  'Super',
  'MetaProperty',
  'AwaitExpression',
  'YieldExpression',
  'ImportExpression',
]);

/**
 * `element`: JSX, split into sub-elements. `fresh`: a literal that makes a fresh value.
 * `value`: anything else, such as a call result, which needs inputs to be cached.
 */
export type CandidateKind = 'element' | 'fresh' | 'value';

export interface Candidate {
  expr: AstNode;
  /** The block code goes before this range. */
  at: Range;
  kind: CandidateKind;
  /** The binding that receives the value of a `const` candidate. */
  result?: Binding;
}

/** A JSX element of a candidate, with the inputs it reads. */
interface Piece {
  node: AstNode;
  range: Range;
  /** The inputs the element reads, or undefined when the element may not be cached. */
  flat: Dep[] | undefined;
  /** Elements nested in unconditional positions: children, attribute values, `{<jsx />}`. */
  subs: Piece[];
}

/** A piece that owns a block. `children` own the blocks nested inside its range. */
interface Owner {
  piece: Piece;
  key: string;
  children: Owner[];
}

/** A value a block reads. `key` tells equal inputs apart, such as `3` and `3.x`. */
interface Dep {
  key: string;
  ref: ValueRef;
  position: number;
}

interface PositionedRef {
  ref: ValueRef;
  position: number;
}

/** The binding of a component's first parameter when it is a plain name. */
function findPropsId(ctx: Context, unitId: number): number | undefined {
  const unit = ctx.scope.units.find((item) => item.id === unitId);
  const node: unknown = unit?.node;
  if (unit?.kind !== 'component' || !isNode(node)) {
    return undefined;
  }
  const params = getChildren(node, 'params');
  const first = params.length > 0 ? params[0] : undefined;
  if (first?.type !== 'Identifier') {
    return undefined;
  }
  const binding = ctx.scope.bindings.find((item) => item.declaration.start === first.start);
  if (!binding) {
    return undefined;
  }
  // A call that gets `props` or one of its properties may change it in place, anywhere in the unit.
  for (const reference of binding.references) {
    const target: unknown = reference.node;
    if (!isNode(target) || reference.write || !isReadOnlyUse(ctx, target)) {
      return undefined;
    }
  }
  return binding.id;
}

export function unwrap(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current?.type === 'ParenthesizedExpression') {
    current = getChild(current, 'expression');
  }
  return current;
}

/** Finds the elements and call sites nested in positions that always run when the element runs. */
function findSubElements(node: AstNode, isCallSite: (call: AstNode) => boolean): AstNode[] {
  const found: AstNode[] = [];
  const items: (AstNode | undefined)[] = [];
  const opening = getChild(node, 'openingElement');
  for (const attribute of opening ? getChildren(opening, 'attributes') : []) {
    if (attribute.type === 'JSXAttribute') {
      items.push(getChild(attribute, 'value'));
    }
  }
  items.push(...getChildren(node, 'children'));
  for (const item of items) {
    const direct = unwrap(item);
    const inner =
      direct?.type === 'JSXExpressionContainer' ? unwrap(getChild(direct, 'expression')) : direct;
    if (inner && (isElement(inner) || isCallSite(inner))) {
      found.push(inner);
    }
  }
  return found;
}

export function classify(expr: AstNode): CandidateKind {
  if (isElement(expr)) {
    return 'element';
  }
  return FRESH_LITERALS.has(expr.type) ? 'fresh' : 'value';
}

/** Visits the nodes inside `range`, skipping subtrees that do not touch it. */
function scanRange(root: AstNode, range: Range, visit: (node: AstNode) => boolean): boolean {
  const stack: AstNode[] = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (node.end < range.start || node.start > range.end) {
      continue;
    }
    if (isInside(getRange(node), range) && !visit(node)) {
      return false;
    }
    pushChildren(node, stack);
  }
  return true;
}

export function isGlobalStable(ctx: Context, range: Range): boolean {
  for (const reference of ctx.globals) {
    if (isInside(reference.range, range)) {
      const node: unknown = reference.node;
      const name =
        typeof node === 'object' && node !== null && 'name' in node ? node.name : undefined;
      if (typeof name !== 'string' || !STABLE_GLOBALS.has(name)) {
        return false;
      }
    }
  }
  return true;
}

export class GroupPlanner {
  private readonly groupOf = new Map<number, Group>();

  /** Bindings that receive the output of a block. */
  private readonly cached = new Set<number>();

  private readonly blocks: SlotBlock[] = [];

  private size: number;

  private at: Range = { start: 0, end: 0 };

  private frozen = new Map<number, boolean>();

  /** The props object of a component. It is never nullish, so its properties can be inputs. */
  private readonly propsId: number | undefined;

  /** Binding ids read by the tests that guard each frozen group's writes. */
  private readonly guardIds = new Map<number, number[]>();

  constructor(
    private readonly ctx: Context,
    ownership: OwnershipResult,
    private readonly plan: CachePlan,
  ) {
    this.size = plan.root.size;
    this.propsId = findPropsId(ctx, plan.unit);
    for (const group of ownership.groups) {
      for (const member of group.members) {
        this.groupOf.set(member, group);
      }
    }
  }

  run(body: AstNode): CachePlan {
    // An expression body is one statement. A block body is a list of them.
    const candidates: Candidate[] = [];
    if (body.type === 'BlockStatement') {
      for (const statement of getChildren(body, 'body')) {
        const candidate = this.findCandidate(statement);
        if (candidate) {
          candidates.push(candidate);
        }
        candidates.push(...this.findTryCandidates(statement));
      }
    } else if (isElement(body)) {
      candidates.push({ expr: body, at: getRange(body), kind: 'element' });
    }

    // Statements are planned in source order, so a later one can read an earlier output.
    for (const candidate of candidates) {
      this.planCandidate(candidate);
    }
    if (this.blocks.length === 0) {
      return this.plan;
    }
    const root = this.plan.root;
    return {
      ...this.plan,
      root: { ...root, size: this.size, blocks: [...root.blocks, ...this.blocks] },
    };
  }

  /**
   * The calls a `try` statement stores in a `let`, as in `out = risky(a);`. The block sits
   * inside the `try`, so a call that throws leaves the slots as they were and runs again.
   */
  private findTryCandidates(statement: AstNode): Candidate[] {
    const found: Candidate[] = [];
    if (statement.type !== 'TryStatement') {
      return found;
    }
    const handler = getChild(statement, 'handler');
    const regions = [
      getChild(statement, 'block'),
      handler && getChild(handler, 'body'),
      getChild(statement, 'finalizer'),
    ];
    for (const region of regions) {
      for (const inner of region ? getChildren(region, 'body') : []) {
        const candidate = this.findAssignedCall(inner);
        if (candidate) {
          found.push(candidate);
        }
      }
    }
    return found;
  }

  /** `name = call(...)`, where `name` is a local that is only assigned and read. */
  private findAssignedCall(statement: AstNode): Candidate | undefined {
    if (statement.type !== 'ExpressionStatement') {
      return undefined;
    }
    const assignment = unwrap(getChild(statement, 'expression'));
    const right = unwrap(assignment && getChild(assignment, 'right'));
    const left = assignment && getChild(assignment, 'left');
    if (assignment?.type !== 'AssignmentExpression' || assignment.operator !== '=') {
      return undefined;
    }
    if (left?.type !== 'Identifier' || right?.type !== 'CallExpression') {
      return undefined;
    }
    const entry = this.ctx.refs.find((item) => item.reference.range.start === left.start);
    const binding = entry?.binding;
    const isLocal = binding && isInside(binding.declaration, this.ctx.unitRange);
    if (!binding || !isLocal || !isAssignedReadOnly(this.ctx, binding)) {
      return undefined;
    }
    return { expr: right, at: getRange(statement), kind: 'value' };
  }

  /** The blocks planned so far and the slot count they use. */
  take(): { size: number; blocks: SlotBlock[] } {
    return { size: this.size, blocks: this.blocks };
  }

  /**
   * Finds the expression a statement may cache: a returned value, or the initializer of a
   * `const`. With `allowAssign`, also `name = <jsx />`, which branch arms use.
   */
  findCandidate(statement: AstNode, allowAssign = false): Candidate | undefined {
    const at = getRange(statement);

    // `name = <jsx />`
    if (allowAssign && statement.type === 'ExpressionStatement') {
      const assignment = unwrap(getChild(statement, 'expression'));
      const right = unwrap(assignment && getChild(assignment, 'right'));
      const left = assignment && getChild(assignment, 'left');
      const isPlain = assignment?.type === 'AssignmentExpression' && assignment.operator === '=';
      return isPlain && left?.type === 'Identifier' && isElement(right)
        ? { expr: right, at, kind: 'element' }
        : undefined;
    }

    // `return <expr>`
    if (statement.type === 'ReturnStatement') {
      const argument = unwrap(getChild(statement, 'argument'));
      return argument ? { expr: argument, at, kind: classify(argument) } : undefined;
    }

    // `const x = <expr>`, with one declarator and a plain name.
    if (statement.type !== 'VariableDeclaration') {
      return undefined;
    }
    const declarators = getChildren(statement, 'declarations');
    if (declarators.length !== 1) {
      return undefined;
    }
    const id = getChild(declarators[0], 'id');
    const init = unwrap(getChild(declarators[0], 'init'));
    if (id?.type !== 'Identifier' || !init) {
      return undefined;
    }
    const kind = classify(init);
    if (kind === 'element') {
      return { expr: init, at, kind };
    }

    // A fresh value that a group changes, or a call result that is handed on, may not be shared.
    const result = this.ctx.scope.bindings.find((item) => item.declaration.start === id.start);
    if (!result || this.ctx.unsafe.has(result.id)) {
      return undefined;
    }
    if (kind === 'value' && !isResultReadOnly(this.ctx, result)) {
      return undefined;
    }
    return { expr: init, at, kind, result };
  }

  /** Plans the blocks of one candidate. */
  planCandidate(candidate: Candidate): void {
    // An expression cheaper than one compare gets no slot.
    if (candidate.kind !== 'element' && isCheap(candidate.expr)) {
      return;
    }
    this.at = candidate.at;
    this.frozen = new Map();

    // Split the elements by the inputs they read, then give each distinct input set a block.
    const root = this.createPiece(candidate.expr);
    // A call result with no inputs has nothing that says when to run it again.
    if (candidate.kind === 'value' && (root.flat?.length ?? 0) === 0) {
      return;
    }
    const region: Owner[] = [];
    this.place(root, undefined, region);
    this.buildRegion(region);

    // Later statements read the result through its slot value.
    if (candidate.result && region.length === 1 && region[0].piece === root) {
      this.cached.add(candidate.result.id);
    }
  }

  private createPiece(node: AstNode): Piece {
    const subs: Piece[] = [];
    for (const sub of findSubElements(node, (call) => this.isGroupMap(call))) {
      subs.push(this.createPiece(sub));
    }
    const range = getRange(node);
    const deps = this.isCacheable(node) ? this.collectDeps(range, []) : undefined;
    return { node, range, flat: deps, subs };
  }

  /** Decides which pieces own a block. A piece with the inputs of its owner joins the owner's block. */
  private place(piece: Piece, ownerKey: string | undefined, region: Owner[]): void {
    if (!piece.flat) {
      for (const sub of piece.subs) {
        this.place(sub, undefined, region);
      }
      return;
    }
    const keys: string[] = [];
    for (const dep of piece.flat) {
      keys.push(dep.key);
    }
    const key = keys.sort().join(',');
    if (ownerKey === key) {
      for (const sub of piece.subs) {
        this.place(sub, key, region);
      }
      return;
    }
    const owner: Owner = { piece, key, children: [] };
    region.push(owner);
    for (const sub of piece.subs) {
      this.place(sub, key, owner.children);
    }
  }

  /** Adds the blocks of a region, inner blocks first, and returns the output each owner left. */
  private buildRegion(region: Owner[]): Map<Owner, ValueRef> {
    const outputs = new Map<Owner, ValueRef>();

    // Leaves with one input set share one compare. Owners with inner blocks build alone.
    const shared = new Map<string, Owner[]>();
    for (const owner of region) {
      if (owner.children.length > 0) {
        outputs.set(owner, this.buildOwner(owner));
        continue;
      }
      const list = shared.get(owner.key) ?? [];
      list.push(owner);
      shared.set(owner.key, list);
    }
    for (const list of shared.values()) {
      this.buildShared(list, outputs);
    }
    return outputs;
  }

  private buildOwner(owner: Owner): ValueRef {
    // Inner blocks come first. The owner compares their outputs instead of their inputs.
    const inner = this.buildRegion(owner.children);
    const excluded: Range[] = [];
    const refs: PositionedRef[] = [];
    for (const child of owner.children) {
      excluded.push(child.piece.range);
      const ref = inner.get(child);
      if (ref) {
        refs.push({ ref, position: child.piece.range.start });
      }
    }
    for (const dep of this.collectDeps(owner.piece.range, excluded) ?? []) {
      refs.push({ ref: dep.ref, position: dep.position });
    }
    refs.sort((left, right) => left.position - right.position);
    const inputs: ValueRef[] = [];
    for (const item of refs) {
      inputs.push(item.ref);
    }
    return this.pushBlock(inputs, [owner.piece])[0];
  }

  private buildShared(list: Owner[], outputs: Map<Owner, ValueRef>): void {
    const inputs: ValueRef[] = [];
    for (const dep of list[0].piece.flat ?? []) {
      inputs.push(dep.ref);
    }
    const pieces: Piece[] = [];
    for (const owner of list) {
      pieces.push(owner.piece);
    }
    const refs = this.pushBlock(inputs, pieces);
    for (const [index, owner] of list.entries()) {
      outputs.set(owner, refs[index]);
    }
  }

  private pushBlock(inputs: ValueRef[], pieces: Piece[]): ValueRef[] {
    const id = this.plan.root.blocks.length + this.blocks.length;
    const refs: ValueRef[] = [];
    const outputs: SlotBlock['outputs'] = [];
    for (const [index, piece] of pieces.entries()) {
      outputs.push({ range: piece.range, local: createLocal(this.ctx, id) });
      refs.push({ kind: 'output', block: id, index });
    }
    this.blocks.push({ id, kind: 'value', first: this.size, inputs, outputs, at: this.at });
    this.size += inputs.length + outputs.length;
    return refs;
  }

  /** True when the node reads no hidden state and calls nothing that can change one. */
  private isCacheable(node: AstNode): boolean {
    if (!isPureSyntax(this.ctx, node)) {
      return false;
    }
    // A closure may run during render wherever it is passed, so it reads no changing global.
    // Writing to a global (`globalThis.n = id`) reads no value and stays allowed in a closure.
    const range = getRange(node);
    const deferred = findDeferred(node);
    for (const reference of this.ctx.globals) {
      if (!isInside(reference.range, range) || isGlobalStable(this.ctx, reference.range)) {
        continue;
      }
      let isLater = false;
      for (const item of deferred) {
        isLater ||= isInside(reference.range, item);
      }
      if (!isLater || !this.isGlobalWrite(reference)) {
        return false;
      }
    }
    // Hidden state in a closure body, such as `ref.current` or `Math.random`, is not pure either.
    return walkNodes(node, (item) => {
      if (item.type !== 'MemberExpression') {
        return true;
      }
      const name = getMemberName(item);
      return name === undefined || !IMPURE_MEMBERS.has(name);
    });
  }

  /** True when the global is only the object of an assignment target, as in `globalThis.n = id`. */
  private isGlobalWrite(reference: Reference): boolean {
    const node: unknown = reference.node;
    const parent = isNode(node) ? this.ctx.index.parents.get(node) : undefined;
    const outer = parent && this.ctx.index.parents.get(parent);
    return (
      parent?.type === 'MemberExpression' &&
      getChild(parent, 'object') === node &&
      outer?.type === 'AssignmentExpression' &&
      outer.operator === '=' &&
      getChild(outer, 'left') === parent
    );
  }

  /** True for `xs.map(fn)` where `xs` holds a group, so its result can be kept on the group's inputs. */
  private isGroupMap(node: AstNode): boolean {
    if (node.type !== 'CallExpression' || getCalleeName(node) !== 'map') {
      return false;
    }
    const callee = getChild(node, 'callee');
    const object = callee && getChild(callee, 'object');
    const args = getChildren(node, 'arguments');
    if (callee?.type !== 'MemberExpression' || object?.type !== 'Identifier' || args.length !== 1) {
      return false;
    }
    const isFunction =
      args[0].type === 'ArrowFunctionExpression' || args[0].type === 'FunctionExpression';
    const entry = this.ctx.refs.find((item) => item.reference.range.start === object.start);
    return isFunction && entry !== undefined && this.groupOf.has(entry.binding.id);
  }

  /**
   * The binding ids a range reads, in source order, outside the `excluded` ranges. A member
   * of a frozen group stands for the group's inputs. Undefined when any read may change.
   */
  private collectDeps(range: Range, excluded: Range[]): Dep[] | undefined {
    const visible: UnitRef[] = [];
    for (const item of this.ctx.refs) {
      const { reference, binding } = item;
      if (!isInside(reference.range, range) || isInside(binding.declaration, range)) {
        continue;
      }
      let skip = false;
      for (const hole of excluded) {
        skip ||= isInside(reference.range, hole);
      }
      if (!skip) {
        visible.push(item);
      }
    }

    // The props object is read by property when every read in the range is a plain property read.
    const isByName = new Map<number, boolean>();
    for (const { reference, binding } of visible) {
      if (binding.id === this.propsId) {
        const known = isByName.get(binding.id) ?? true;
        isByName.set(binding.id, known && this.getReadName(reference) !== undefined);
      }
    }

    const deps: Dep[] = [];
    const seen = new Set<string>();
    for (const { reference, binding } of visible) {
      const ids = this.getBindingDeps(binding);
      if (!ids) {
        return undefined;
      }
      const name = this.getReadName(reference);
      const isMember =
        name !== undefined &&
        isByName.get(binding.id) === true &&
        ids.length === 1 &&
        ids[0] === binding.id;
      const found: Dep[] = [];
      if (isMember) {
        const ref: ValueRef = { kind: 'member', id: binding.id, name };
        found.push({ key: `${binding.id}.${name}`, ref, position: reference.range.start });
      } else {
        for (const id of ids) {
          const ref: ValueRef = { kind: 'binding', id };
          found.push({ key: String(id), ref, position: reference.range.start });
        }
      }
      for (const dep of found) {
        if (!seen.has(dep.key)) {
          seen.add(dep.key);
          deps.push(dep);
        }
      }
    }
    return deps;
  }

  /** The property a reference reads as `props.name`, or undefined for any other use. */
  private getReadName(reference: Reference): string | undefined {
    const node: unknown = reference.node;
    const parent = isNode(node) ? this.ctx.index.parents.get(node) : undefined;
    if (parent?.type !== 'MemberExpression' || parent.computed === true) {
      return undefined;
    }
    const property = getChild(parent, 'property');
    if (parent.optional === true || getChild(parent, 'object') !== node) {
      return undefined;
    }
    if (property?.type !== 'Identifier' || typeof property.name !== 'string') {
      return undefined;
    }
    return property.name;
  }

  private getBindingDeps(binding: Binding): number[] | undefined {
    const ctx = this.ctx;
    if (!isInside(binding.declaration, ctx.unitRange)) {
      return isStableOuter(ctx, binding) ? [] : undefined;
    }
    // A cached value keeps one identity until its inputs change, so it is its own input.
    if (this.cached.has(binding.id)) {
      return isPlainInput(ctx, binding, this.at.start) ? [binding.id] : undefined;
    }
    const group = this.groupOf.get(binding.id);
    if (group && this.isFrozenGroup(group)) {
      return [...group.inputs, ...(this.guardIds.get(group.id) ?? [])];
    }
    return isPlainInput(ctx, binding, this.at.start) ? [binding.id] : undefined;
  }

  /** True when the group is final before the block, is built from its inputs alone, and they are plain. */
  private isFrozenGroup(group: Group): boolean {
    const known = this.frozen.get(group.id);
    if (known !== undefined) {
      return known;
    }
    let ok = group.created.length > 0 && group.frozenAt <= this.at.start;
    if (ok) {
      const writes = this.findMemberWrites(group);
      const ranges = [...group.created, ...(writes ?? [])];
      for (const mutation of group.mutations) {
        ranges.push(mutation.range);
      }
      ok = writes !== undefined;
      for (const range of ranges) {
        if (ok && !this.isPureGroupCode(range)) {
          ok = false;
        }
      }
    }
    // A write inside a conditional also depends on the tests that decide whether it runs.
    if (ok) {
      const guards = this.findGuardIds(group);
      if (guards) {
        this.guardIds.set(group.id, guards);
      } else {
        ok = false;
      }
    }
    if (ok) {
      for (const id of group.inputs) {
        if (!isPlainInput(this.ctx, this.ctx.scope.bindings[id], this.at.start)) {
          ok = false;
          break;
        }
      }
    }
    this.frozen.set(group.id, ok);
    return ok;
  }

  /**
   * The binding ids read by every test that guards a write or mutation of the group, outside
   * the group's own inputs. Undefined when a test is impure or reads a value that can change.
   */
  private findGuardIds(group: Group): number[] | undefined {
    const ctx = this.ctx;
    const writes = this.findMemberWrites(group);
    if (!writes) {
      return undefined;
    }
    const ranges = [...group.created, ...writes];
    for (const mutation of group.mutations) {
      ranges.push(mutation.range);
    }

    // Collect the tests on the path from the unit body to each write.
    const tests: AstNode[] = [];
    for (const range of ranges) {
      if (!this.findGuards(range, tests)) {
        return undefined;
      }
    }

    // Each test must be pure and read plain inputs only.
    const ids: number[] = [];
    for (const test of tests) {
      const testRange = getRange(test);
      if (!isPureSyntax(ctx, test) || !isGlobalStable(ctx, testRange)) {
        return undefined;
      }
      for (const { reference, binding } of ctx.refs) {
        if (!isInside(reference.range, testRange)) {
          continue;
        }
        if (!isPlainInput(ctx, binding, this.at.start)) {
          return undefined;
        }
        if (isInside(binding.declaration, ctx.unitRange) && !ids.includes(binding.id)) {
          ids.push(binding.id);
        }
      }
    }
    return ids;
  }

  /**
   * Adds the tests of the `if`, `switch`, ternary and logical nodes that hold `range` in a branch.
   * Returns false when a loop, or an earlier `break`, `continue` or `throw` in a labeled
   * statement, `try` block or `switch` case, can skip the range.
   */
  private findGuards(range: Range, tests: AstNode[]): boolean {
    let node: AstNode = this.ctx.index.root;
    while (node.start !== range.start || node.end !== range.end) {
      const children: AstNode[] = [];
      pushChildren(node, children);
      let next: AstNode | undefined;
      for (const child of children) {
        if (isInside(range, getRange(child))) {
          next = child;
          break;
        }
      }
      if (!next) {
        return true;
      }
      if (this.canSkip(node, next, range)) {
        return false;
      }
      this.addGuards(node, next, tests);
      node = next;
    }
    return true;
  }

  private canSkip(node: AstNode, child: AstNode, range: Range): boolean {
    if (!isInside(getRange(node), this.ctx.unitRange)) {
      return false;
    }
    // Any loop repeats the write, and the cache cannot tell which pass it keeps.
    if (LOOPS.has(node.type)) {
      return true;
    }
    const isRegion =
      node.type === 'LabeledStatement' ||
      node.type === 'SwitchCase' ||
      (node.type === 'TryStatement' && child === getChild(node, 'block'));
    if (!isRegion) {
      return false;
    }
    // An exit before the write, in the same region, can skip it.
    return !walkNodes(node, (item) => {
      const isExit =
        item.type === 'BreakStatement' ||
        item.type === 'ContinueStatement' ||
        item.type === 'ThrowStatement';
      return !(isExit && item.end <= range.start);
    });
  }

  private addGuards(node: AstNode, child: AstNode, tests: AstNode[]): void {
    if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
      if (child !== getChild(node, 'test')) {
        this.addTest(getChild(node, 'test'), tests);
      }
    } else if (node.type === 'LogicalExpression') {
      if (child === getChild(node, 'right')) {
        this.addTest(getChild(node, 'left'), tests);
      }
    } else if (node.type === 'SwitchStatement' && child.type === 'SwitchCase') {
      // A case also runs by falling through, so every test up to this case counts.
      this.addTest(getChild(node, 'discriminant'), tests);
      for (const item of getChildren(node, 'cases')) {
        this.addTest(getChild(item, 'test'), tests);
        if (item === child) {
          break;
        }
      }
    }
  }

  private addTest(test: AstNode | undefined, tests: AstNode[]): void {
    if (test && isInside(getRange(test), this.ctx.unitRange)) {
      tests.push(test);
    }
  }

  /** The initializers and assignments that give the group's members their values. */
  private findMemberWrites(group: Group): Range[] | undefined {
    const ranges: Range[] = [];
    for (const id of group.members) {
      const binding = this.ctx.scope.bindings[id];
      const init = findInitializer(this.ctx, binding);
      if (init) {
        ranges.push(getRange(init));
      }
      for (const reference of binding.references) {
        if (!reference.write) {
          continue;
        }
        // A write that is not a plain assignment, such as a destructuring target, is not scanned.
        const target: unknown = reference.node;
        const parent = isNode(target) ? this.ctx.index.parents.get(target) : undefined;
        if (parent?.type !== 'AssignmentExpression') {
          return undefined;
        }
        ranges.push(getRange(parent));
      }
    }
    return ranges;
  }

  /**
   * Checks code that builds or changes a group. Writes to the group are allowed. Anything
   * that reads hidden state, or a module binding that can change, is not.
   */
  private isPureGroupCode(range: Range): boolean {
    const ctx = this.ctx;
    const isPure = scanRange(ctx.index.root, range, (node) => {
      if (IMPURE_SYNTAX.has(node.type)) {
        return false;
      }
      if (node.type === 'CallExpression') {
        const name = getCalleeName(node);
        return name !== undefined && !HOOK_NAME.test(name);
      }
      if (node.type === 'MemberExpression') {
        const name = getMemberName(node);
        return name === undefined || !IMPURE_MEMBERS.has(name);
      }
      return true;
    });
    if (!isPure || !isGlobalStable(ctx, range)) {
      return false;
    }
    for (const { reference, binding } of ctx.refs) {
      if (
        isInside(reference.range, range) &&
        !isInside(binding.declaration, ctx.unitRange) &&
        !isStableOuter(ctx, binding)
      ) {
        return false;
      }
    }
    return true;
  }
}

/**
 * S2 planner. Each returned or `const` value that costs more than one compare gets a block
 * in the root node. A JSX tree is split into elements, and elements that read the same inputs
 * share one block. A value built from a group that stays unchanged after its last mutation is
 * keyed on the group's inputs. Hook calls, ref reads, mutated locals and impure code get no slot.
 */
export function runGroups(
  scope: ScopeResult,
  ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  // Locate the unit's function and its body.
  const unit = scope.units.find((item) => item.id === plan.unit);
  const node: unknown = unit?.node;
  if (!unit || !isNode(node)) {
    return plan;
  }
  const ctx = createContext(scope, ownership, getRange(node));
  const body = getChild(node, 'body');
  if (!ctx || !body) {
    return plan;
  }
  return new GroupPlanner(ctx, ownership, plan).run(body);
}
