import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isFunction, isNode } from '../emit/ast';
import type {
  CacheNode,
  CachePlan,
  OwnershipResult,
  Range,
  ScopeResult,
  SlotBlock,
  ValueRef,
} from '../ir';
import type { Context } from './baseline';
import {
  createContext,
  createLocal,
  getName,
  getRange,
  isInside,
  isPlainInput,
  isPureSyntax,
  pushChildren,
} from './baseline';
import type { Candidate } from './groups';
import { GroupPlanner, classify, isGlobalStable, unwrap } from './groups';

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const CHAIN_PARTS = new Set(['MemberExpression', 'CallExpression', 'TSNonNullExpression']);

/** A loop statement or a `.map` call that can get a cache per pass. */
interface Site {
  kind: 'loop' | 'map';
  /** The loop statement, or the call. */
  node: AstNode;
  /** The loop body, or the callback body. */
  body: AstNode;
}

function isSameRange(left: Range, right: Range): boolean {
  return left.start === right.start && left.end === right.end;
}

function getBlockSlots(block: SlotBlock): number {
  return block.kind === 'keep' ? 1 : block.inputs.length + block.outputs.length;
}

/** Packs the blocks of a node, then its child caches, into consecutive slots. */
function layoutNode(node: CacheNode): void {
  let size = 0;
  for (const block of node.blocks) {
    block.first = size;
    size += getBlockSlots(block);
  }
  const ordered = [...node.children].sort(
    (left, right) =>
      (left.parentIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.parentIndex ?? Number.MAX_SAFE_INTEGER),
  );
  for (const child of ordered) {
    child.parentIndex = size;
    size++;
  }
  node.size = size;
}

/** The root and every node below it, outermost first. */
function listNodes(root: CacheNode): CacheNode[] {
  const nodes: CacheNode[] = [root];
  for (const node of nodes) {
    nodes.push(...node.children);
  }
  return nodes;
}

/** The values of a statement that may be cached: its candidate, or the elements it hands to a call. */
function findCandidates(planner: GroupPlanner, statement: AstNode): Candidate[] {
  const candidate = planner.findCandidate(statement, true);
  if (candidate) {
    return [candidate];
  }
  // `rows.push(<Row />)`
  const found: Candidate[] = [];
  const call =
    statement.type === 'ExpressionStatement'
      ? unwrap(getChild(statement, 'expression'))
      : undefined;
  if (call?.type === 'CallExpression') {
    for (const arg of getChildren(call, 'arguments')) {
      const expr = unwrap(arg);
      if (expr && classify(expr) === 'element') {
        found.push({ expr, at: getRange(statement), kind: 'element' });
      }
    }
  }
  return found;
}

class LoopPlanner {
  private nextId = 0;

  constructor(
    private readonly ctx: Context,
    private readonly ownership: OwnershipResult,
    private readonly plan: CachePlan,
  ) {
    // Block ids and output locals stay unique across the whole plan.
    for (const node of listNodes(plan.root)) {
      for (const block of node.blocks) {
        this.nextId = Math.max(this.nextId, block.id + 1);
        for (const output of block.outputs) {
          ctx.names.add(output.local);
        }
      }
    }
  }

  run(): CachePlan {
    this.markCounters();
    this.visit(this.plan.root);
    return this.plan;
  }

  /** Marks the names a `for` header declares, which the loop body only reads. */
  private markCounters(): void {
    const counters = new Set<number>();
    const stack: AstNode[] = [this.ctx.index.root];
    for (let node = stack.pop(); node; node = stack.pop()) {
      pushChildren(node, stack);
      const isFor = node.type === 'ForStatement';
      if (
        !(isFor || node.type === 'ForOfStatement' || node.type === 'ForInStatement') ||
        !isInside(getRange(node), this.ctx.unitRange)
      ) {
        continue;
      }
      const init = getChild(node, isFor ? 'init' : 'left');
      const body = getChild(node, 'body');
      if (init?.type !== 'VariableDeclaration' || !body) {
        continue;
      }
      const declared = getRange(init);
      const isVar = init.kind === 'var';
      for (const binding of this.ctx.scope.bindings) {
        if (!isInside(binding.declaration, declared)) {
          continue;
        }
        // A `var` is one binding for the whole function, so a closure of an earlier pass would
        // see its last value. It is never a plain input.
        if (isVar) {
          this.ctx.unsafe.add(binding.id);
          continue;
        }
        // A write in the body would change the value between the compare and the use.
        let ok = true;
        for (const reference of binding.references) {
          if (reference.write && isInside(reference.range, getRange(body))) {
            ok = false;
          }
        }
        if (ok) {
          counters.add(binding.id);
        }
      }
    }
    this.ctx.perIteration = counters;
  }

  private visit(node: CacheNode): void {
    const existing = [...node.children];

    // Sites in the node's own code, outside the caches below it.
    const excluded: Range[] = [];
    for (const child of node.children) {
      excluded.push(child.range);
    }
    const sites = this.findSites(node.range, excluded);
    for (const site of sites) {
      if (site.kind === 'map') {
        this.attachMap(node, site);
      } else {
        this.attachLoop(node, site);
      }
    }
    for (const child of existing) {
      this.visit(child);
    }
  }

  /** Finds the loops and `.map` calls in a range, never inside a closure or a deeper cache. */
  private findSites(range: Range, excluded: Range[]): Site[] {
    const sites: Site[] = [];
    const stack: AstNode[] = [this.ctx.index.root];
    for (let node = stack.pop(); node; node = stack.pop()) {
      const at = getRange(node);
      if (at.end <= range.start || at.start >= range.end) {
        continue;
      }
      let isHidden = false;
      for (const item of excluded) {
        if (isInside(at, item)) {
          isHidden = true;
        }
      }
      if (isHidden) {
        continue;
      }
      // A closure inside the range runs at another time. The unit function itself is entered.
      if (isFunction(node) && isInside(at, range) && !isSameRange(at, this.ctx.unitRange)) {
        continue;
      }
      const site = isInside(at, range) ? this.createSite(node) : undefined;
      if (site) {
        sites.push(site);
        continue;
      }
      pushChildren(node, stack);
    }
    sites.sort((left, right) => left.node.start - right.node.start);
    return sites;
  }

  private createSite(node: AstNode): Site | undefined {
    if (LOOP_TYPES.has(node.type)) {
      const body = getChild(node, 'body');
      return body && node.await !== true ? { kind: 'loop', node, body } : undefined;
    }
    return this.createMapSite(node);
  }

  private createMapSite(call: AstNode): Site | undefined {
    if (call.type !== 'CallExpression' || call.optional === true) {
      return undefined;
    }
    const callee = getChild(call, 'callee');
    const args = getChildren(call, 'arguments');
    const fn = args.length === 1 ? args[0] : undefined;
    if (
      callee?.type !== 'MemberExpression' ||
      callee.computed === true ||
      callee.optional === true ||
      getName(getChild(callee, 'property') ?? callee) !== 'map' ||
      !fn ||
      (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') ||
      fn.async === true ||
      fn.generator === true
    ) {
      return undefined;
    }
    const body = getChild(fn, 'body');
    const params = getChildren(fn, 'params');
    if (!body || params.length > 2 || params.some((param) => param.type === 'RestElement')) {
      return undefined;
    }
    // Emit names the index itself, so a second parameter must be a plain name.
    if (params.length === 2 && params[1].type !== 'Identifier') {
      return undefined;
    }

    // An optional chain may skip the call, and its code would run before the test.
    let parent = this.ctx.index.parents.get(call);
    while (parent && CHAIN_PARTS.has(parent.type)) {
      parent = this.ctx.index.parents.get(parent);
    }
    if (parent?.type === 'ChainExpression') {
      return undefined;
    }

    // Emit moves the call before its statement, so the receiver must read plain inputs only.
    const receiver = getChild(callee, 'object');
    if (!receiver || !this.isHoistable(receiver, call.start)) {
      return undefined;
    }
    return { kind: 'map', node: call, body };
  }

  private isHoistable(node: AstNode, atStart: number): boolean {
    const range = getRange(node);
    if (!isPureSyntax(this.ctx, node) || !isGlobalStable(this.ctx, range)) {
      return false;
    }
    for (const { reference, binding } of this.ctx.refs) {
      if (
        isInside(reference.range, range) &&
        !isInside(binding.declaration, range) &&
        !isPlainInput(this.ctx, binding, atStart)
      ) {
        return false;
      }
    }
    return true;
  }

  /** Plans the blocks of one loop body or callback body into a new iteration node. */
  private createIteration(body: AstNode): CacheNode {
    const range = getRange(body);
    const root: CacheNode = { kind: 'root', range, size: 0, blocks: [], children: [] };
    const planner = new GroupPlanner(this.ctx, this.ownership, { unit: this.plan.unit, root });

    // An expression body is one candidate. A statement list gives one per statement.
    if (isStatement(body)) {
      const statements = body.type === 'BlockStatement' ? getChildren(body, 'body') : [body];
      for (const statement of statements) {
        for (const candidate of findCandidates(planner, statement)) {
          planner.planCandidate(candidate);
        }
      }
    } else {
      const expr = unwrap(body);
      if (expr) {
        planner.planCandidate({ expr, at: range, kind: classify(expr) });
      }
    }
    const { blocks } = planner.take();

    // The planner numbers blocks from zero. Move them after the ids of the plan.
    const offset = this.nextId;
    this.nextId += blocks.length;
    const moved: SlotBlock[] = [];
    for (const block of blocks) {
      const inputs: ValueRef[] = [];
      for (const ref of block.inputs) {
        inputs.push(ref.kind === 'output' ? { ...ref, block: ref.block + offset } : ref);
      }
      moved.push({ ...block, id: block.id + offset, inputs });
    }
    const node: CacheNode = {
      kind: 'iteration',
      range,
      body: range,
      size: 0,
      blocks: moved,
      children: [],
    };
    return node;
  }

  private attachLoop(node: CacheNode, site: Site): void {
    const child = this.createIteration(site.body);
    if (this.isUseful(child)) {
      node.children.push(child);
      layoutNode(node);
    }
  }

  /** Plans the sites inside a new iteration node. It stays only when it holds a block or a cache. */
  private isUseful(child: CacheNode): boolean {
    this.visit(child);
    layoutNode(child);
    return child.blocks.length > 0 || child.children.length > 0;
  }

  private attachMap(node: CacheNode, site: Site): void {
    const call = getRange(site.node);

    // Blocks of this node that hold the call: one that caches only the call is replaced by the
    // keep block, one that holds more drops the inputs that only the call read.
    const dropped = new Set<number>();
    const patched: SlotBlock[] = [];
    for (const block of node.blocks) {
      let holds = false;
      for (const output of block.outputs) {
        if (isInside(call, output.range)) {
          holds = true;
          if (isSameRange(call, output.range)) {
            if (block.outputs.length !== 1) {
              return;
            }
            dropped.add(block.id);
          }
        }
      }
      if (holds && !dropped.has(block.id)) {
        patched.push(block);
      }
    }
    const child = this.createIteration(site.body);
    if (!this.isUseful(child)) {
      return;
    }

    // The keep block holds the call's array, so a row that did not change keeps the array.
    const id = this.nextId++;
    const keep: SlotBlock = {
      id,
      kind: 'keep',
      first: 0,
      inputs: [],
      outputs: [{ range: call, local: createLocal(this.ctx, id) }],
      at: call,
    };
    const ref: ValueRef = { kind: 'output', block: id, index: 0 };
    for (const block of patched) {
      this.dropCallInputs(block, call, ref);
    }
    const kept: SlotBlock[] = [];
    for (const block of node.blocks) {
      if (dropped.has(block.id)) {
        continue;
      }
      const inputs: ValueRef[] = [];
      for (const input of block.inputs) {
        inputs.push(input.kind === 'output' && dropped.has(input.block) ? ref : input);
      }
      block.inputs = inputs;
      kept.push(block);
    }
    kept.push(keep);
    node.blocks = kept;
    node.children.push(child);
    layoutNode(node);
  }

  /** Replaces the inputs that only the call reads with the output of its keep block. */
  private dropCallInputs(block: SlotBlock, call: Range, ref: ValueRef): void {
    const inside = new Set<number>();
    const outside = new Set<number>();
    const members = new Set<number>();
    for (const group of this.ownership.groups) {
      for (const member of group.members) {
        members.add(member);
      }
    }
    for (const { reference, binding } of this.ctx.refs) {
      let held = false;
      for (const output of block.outputs) {
        held ||= isInside(reference.range, output.range);
      }
      if (!held) {
        continue;
      }
      if (isInside(reference.range, call)) {
        inside.add(binding.id);
      } else {
        outside.add(binding.id);
        // A group member stands for the group's inputs, so those inputs may be read outside too.
        if (members.has(binding.id)) {
          return;
        }
      }
    }

    const inputs: ValueRef[] = [];
    let removed = false;
    for (const input of block.inputs) {
      if (input.kind === 'binding' && inside.has(input.id) && !outside.has(input.id)) {
        removed = true;
      } else {
        inputs.push(input);
      }
    }
    if (removed) {
      inputs.push(ref);
      block.inputs = inputs;
    }
  }
}

function isStatement(node: AstNode): boolean {
  return (
    node.type.endsWith('Statement') ||
    node.type === 'VariableDeclaration' ||
    LOOP_TYPES.has(node.type)
  );
}

/**
 * S3 planner. A loop body and the callback of a `.map` call each get an iteration cache, one
 * child cache per position, so a row whose inputs did not change keeps its elements. A `.map`
 * result is passed through a keep block, which hands back the previous array when every row
 * is the same. Rows are keyed by position only.
 */
export function runLoops(
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
  if (!ctx || !getChild(node, 'body')) {
    return plan;
  }
  return new LoopPlanner(ctx, ownership, structuredClone(plan)).run();
}
