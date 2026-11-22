import type { AstNode } from '../emit/ast';
import { getChild, getChildren, isNode } from '../emit/ast';
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
import { createContext, getRange, isInside, isPlainInput, isPureSyntax } from './baseline';
import type { Candidate } from './groups';
import { GroupPlanner, classify, isGlobalStable, unwrap } from './groups';

const LOGICAL_SITES = new Set(['&&', '||', '??']);

/** True for an expression whose arm runs only on a condition: `?:`, `&&`, `||`, `??`. */
function isSite(node: AstNode): boolean {
  return (
    node.type === 'ConditionalExpression' ||
    (node.type === 'LogicalExpression' &&
      typeof node.operator === 'string' &&
      LOGICAL_SITES.has(node.operator))
  );
}

/** Finds the arms that are not conditionals themselves, so a chain gets one cache per leaf. */
function collectArms(site: AstNode, arms: AstNode[]): void {
  const keys = site.type === 'ConditionalExpression' ? ['consequent', 'alternate'] : ['right'];
  for (const key of keys) {
    const arm = getChild(site, key);
    if (!arm) {
      continue;
    }
    const inner = unwrap(arm);
    if (inner && isSite(inner)) {
      collectArms(inner, arms);
    } else {
      arms.push(arm);
    }
  }
}

/** Finds the conditionals in a JSX child or attribute position, never inside a function. */
function findNestedSites(node: AstNode | undefined, sites: AstNode[]): void {
  if (!node) {
    return;
  }
  switch (node.type) {
    case 'JSXElement': {
      const opening = getChild(node, 'openingElement');
      for (const attribute of opening ? getChildren(opening, 'attributes') : []) {
        findNestedSites(attribute, sites);
      }
      for (const child of getChildren(node, 'children')) {
        findNestedSites(child, sites);
      }
      return;
    }
    case 'JSXFragment':
      for (const child of getChildren(node, 'children')) {
        findNestedSites(child, sites);
      }
      return;
    case 'JSXAttribute':
      findNestedSites(getChild(node, 'value'), sites);
      return;
    case 'JSXExpressionContainer':
    case 'ParenthesizedExpression':
      findNestedSites(getChild(node, 'expression'), sites);
      return;
    default:
      if (isSite(node)) {
        sites.push(node);
      }
  }
}

class BranchPlanner {
  /** The next block id of the plan. Ids stay unique across nodes. */
  private nextId = 0;

  /** Ids of root blocks that child caches replace. */
  private readonly dropped = new Set<number>();

  private readonly rootChildren: CacheNode[] = [];

  constructor(
    private readonly ctx: Context,
    private readonly ownership: OwnershipResult,
    private readonly plan: CachePlan,
  ) {
    for (const block of plan.root.blocks) {
      this.nextId = Math.max(this.nextId, block.id + 1);
    }
  }

  run(body: AstNode): CachePlan {
    // The root planner only finds candidates. The groups pass already planned the root blocks.
    const planner = this.createPlanner(this.plan.root.range);
    if (body.type === 'BlockStatement') {
      for (const statement of getChildren(body, 'body')) {
        this.planStatement(statement, planner, this.rootChildren, true);
      }
    } else {
      const expr = unwrap(body);
      if (expr) {
        const candidate: Candidate = { expr, at: getRange(body), kind: classify(expr) };
        this.planCandidate(candidate, planner, this.rootChildren, true);
      }
    }
    return this.finishRoot();
  }

  private createPlanner(range: Range): GroupPlanner {
    const root: CacheNode = { kind: 'branch', range, size: 0, blocks: [], children: [] };
    return new GroupPlanner(this.ctx, this.ownership, { unit: this.plan.unit, root });
  }

  /** Plans one statement: an `if` or `switch` gives its arms caches, a candidate gets blocks. */
  private planStatement(
    statement: AstNode,
    planner: GroupPlanner,
    out: CacheNode[],
    isRoot: boolean,
  ): void {
    if (statement.type === 'IfStatement') {
      this.planIf(statement, out);
      return;
    }
    if (statement.type === 'SwitchStatement') {
      for (const item of getChildren(statement, 'cases')) {
        this.planArm(item, getChildren(item, 'consequent'), out);
      }
      return;
    }

    // A plain block inside an arm shares the arm's cache. Root blocks are left to the groups pass.
    if (statement.type === 'BlockStatement') {
      if (!isRoot) {
        for (const inner of getChildren(statement, 'body')) {
          this.planStatement(inner, planner, out, false);
        }
      }
      return;
    }
    const candidate = planner.findCandidate(statement, !isRoot);
    if (candidate) {
      this.planCandidate(candidate, planner, out, isRoot);
    }
  }

  private planIf(statement: AstNode, out: CacheNode[]): void {
    const consequent = getChild(statement, 'consequent');
    if (consequent) {
      this.planArmStatement(consequent, out);
    }
    const alternate = getChild(statement, 'alternate');
    if (!alternate) {
      return;
    }

    // `else if` tests run only when this test fails, and its arms are caches of this node.
    if (alternate.type === 'IfStatement') {
      this.planIf(alternate, out);
    } else {
      this.planArmStatement(alternate, out);
    }
  }

  private planArmStatement(arm: AstNode, out: CacheNode[]): void {
    const statements = arm.type === 'BlockStatement' ? getChildren(arm, 'body') : [arm];
    this.planArm(arm, statements, out);
  }

  /** Gives an arm that holds statements its own cache. An arm with no block adds none. */
  private planArm(arm: AstNode, statements: AstNode[], out: CacheNode[]): void {
    const planner = this.createPlanner(getRange(arm));
    const children: CacheNode[] = [];
    for (const statement of statements) {
      this.planStatement(statement, planner, children, false);
    }
    out.push(...this.createNodes(getRange(arm), planner, children));
  }

  private planCandidate(
    candidate: Candidate,
    planner: GroupPlanner,
    out: CacheNode[],
    isRoot: boolean,
  ): void {
    const expr = unwrap(candidate.expr);
    if (!expr) {
      return;
    }

    // A conditional value gives each arm a cache. The root blocks it replaces are dropped.
    if (isSite(expr)) {
      const nodes = this.planSite(expr);
      if (nodes.length > 0) {
        if (isRoot) {
          this.dropBlocksAt(candidate.at);
        }
        out.push(...nodes);
      }
      return;
    }

    // Root candidates were planned by the groups pass already.
    if (!isRoot) {
      planner.planCandidate(candidate);
    }
    this.planNested(expr, candidate.at.start, out);
  }

  /** Plans the conditionals in JSX positions of an expression. */
  private planNested(expr: AstNode, atStart: number, out: CacheNode[]): void {
    const sites: AstNode[] = [];
    findNestedSites(expr, sites);
    for (const site of sites) {
      if (this.isHoistable(site, atStart)) {
        out.push(...this.planSite(site));
      }
    }
  }

  /** Emit moves a conditional before its statement, so it must not read what an earlier part changes. */
  private isHoistable(site: AstNode, atStart: number): boolean {
    const range = getRange(site);
    if (!isPureSyntax(this.ctx, site) || !isGlobalStable(this.ctx, range)) {
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

  private planSite(site: AstNode): CacheNode[] {
    const arms: AstNode[] = [];
    collectArms(site, arms);
    const nodes: CacheNode[] = [];
    for (const arm of arms) {
      nodes.push(...this.planExpressionArm(arm));
    }
    return nodes;
  }

  private planExpressionArm(arm: AstNode): CacheNode[] {
    const expr = unwrap(arm);
    if (!expr) {
      return [];
    }
    const range = getRange(arm);
    const planner = this.createPlanner(range);
    const children: CacheNode[] = [];
    planner.planCandidate({ expr, at: range, kind: classify(expr) });
    this.planNested(expr, range.start, children);
    return this.createNodes(range, planner, children);
  }

  /** Builds the node of an arm, or hands its children up when the arm has no block of its own. */
  private createNodes(range: Range, planner: GroupPlanner, children: CacheNode[]): CacheNode[] {
    const { size, blocks } = planner.take();
    if (blocks.length === 0) {
      return children;
    }

    // Block ids are unique in the plan, and each child cache takes one slot after the blocks.
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
    let total = size;
    for (const child of children) {
      child.parentIndex = total;
      total++;
    }
    return [{ kind: 'branch', range, arm: range, size: total, blocks: moved, children }];
  }

  private dropBlocksAt(at: Range): void {
    for (const block of this.plan.root.blocks) {
      if (block.at.start === at.start && block.at.end === at.end) {
        this.dropped.add(block.id);
      }
    }
  }

  private finishRoot(): CachePlan {
    if (this.rootChildren.length === 0) {
      return this.plan;
    }

    // Dropped blocks free their slots, so the others move down to stay contiguous.
    const root = this.plan.root;
    const kept: SlotBlock[] = [];
    let size = this.dropped.size === 0 ? root.size : 0;
    for (const block of root.blocks) {
      if (this.dropped.has(block.id)) {
        continue;
      }
      if (this.dropped.size === 0) {
        kept.push(block);
        continue;
      }
      kept.push({ ...block, first: size });
      size += block.kind === 'keep' ? 1 : block.inputs.length + block.outputs.length;
    }

    // Each child cache takes one slot after the blocks.
    for (const child of this.rootChildren) {
      child.parentIndex = size;
      size++;
    }
    return {
      ...this.plan,
      root: { ...root, size, blocks: kept, children: [...root.children, ...this.rootChildren] },
    };
  }
}

/**
 * S3 planner. A conditional value (`?:`, `&&`, `||`, `??`), an `if` arm and a `switch` case
 * each get a child cache that exists only once the arm runs, so an input of an arm that is
 * not taken never invalidates the arm that is. Arm blocks come from the groups planner, so
 * every refusal of the groups pass holds inside an arm. A hook call is never part of a block.
 */
export function runBranches(
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
  return new BranchPlanner(ctx, ownership, plan).run(body);
}
