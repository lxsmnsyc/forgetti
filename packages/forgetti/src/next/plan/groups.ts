import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
import type {
  Binding,
  CachePlan,
  Group,
  OwnershipResult,
  Range,
  ScopeResult,
  SlotBlock,
  ValueRef,
} from '../ir';
import type { Context } from './baseline';
import {
  HOOK_NAME,
  IMPURE_MEMBERS,
  STABLE_GLOBALS,
  createContext,
  createLocal,
  findInitializer,
  getCalleeName,
  getMemberName,
  getRange,
  isElement,
  isInside,
  isPlainInput,
  isPureSyntax,
  isResultReadOnly,
  isStableOuter,
  pushChildren,
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
  /** Binding ids the element reads, or undefined when the element may not be cached. */
  flat: number[] | undefined;
  /** Elements nested in unconditional positions: children, attribute values, `{<jsx />}`. */
  subs: Piece[];
}

/** A piece that owns a block. `children` own the blocks nested inside its range. */
interface Owner {
  piece: Piece;
  key: string;
  children: Owner[];
}

interface Dep {
  id: number;
  position: number;
}

interface PositionedRef {
  ref: ValueRef;
  position: number;
}

export function unwrap(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current?.type === 'ParenthesizedExpression') {
    current = getChild(current, 'expression');
  }
  return current;
}

/** Finds the elements nested in positions that always run when the element runs. */
function findSubElements(node: AstNode): AstNode[] {
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
    if (inner && isElement(inner)) {
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

  constructor(
    private readonly ctx: Context,
    ownership: OwnershipResult,
    private readonly plan: CachePlan,
  ) {
    this.size = plan.root.size;
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
    for (const sub of findSubElements(node)) {
      subs.push(this.createPiece(sub));
    }
    const range = getRange(node);
    const deps = this.isCacheable(node) ? this.collectDeps(range, []) : undefined;
    const flat: number[] | undefined = [];
    for (const dep of deps ?? []) {
      flat.push(dep.id);
    }
    return { node, range, flat: deps ? flat : undefined, subs };
  }

  /** Decides which pieces own a block. A piece with the inputs of its owner joins the owner's block. */
  private place(piece: Piece, ownerKey: string | undefined, region: Owner[]): void {
    if (!piece.flat) {
      for (const sub of piece.subs) {
        this.place(sub, undefined, region);
      }
      return;
    }
    const key = [...piece.flat].sort((left, right) => left - right).join(',');
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
      refs.push({ ref: { kind: 'binding', id: dep.id }, position: dep.position });
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
    for (const id of list[0].piece.flat ?? []) {
      inputs.push({ kind: 'binding', id });
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
    return isPureSyntax(this.ctx, node) && isGlobalStable(this.ctx, getRange(node));
  }

  /**
   * The binding ids a range reads, in source order, outside the `excluded` ranges. A member
   * of a frozen group stands for the group's inputs. Undefined when any read may change.
   */
  private collectDeps(range: Range, excluded: Range[]): Dep[] | undefined {
    const deps: Dep[] = [];
    const seen = new Set<number>();
    for (const { reference, binding } of this.ctx.refs) {
      if (!isInside(reference.range, range) || isInside(binding.declaration, range)) {
        continue;
      }
      let skip = false;
      for (const item of excluded) {
        if (isInside(reference.range, item)) {
          skip = true;
          break;
        }
      }
      if (skip) {
        continue;
      }
      const ids = this.getBindingDeps(binding);
      if (!ids) {
        return undefined;
      }
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          deps.push({ id, position: reference.range.start });
        }
      }
    }
    return deps;
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
      return group.inputs;
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
