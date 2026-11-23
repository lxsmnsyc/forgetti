import type { AstNode } from '../emit/ast';
import { findExact, getChild, getChildren, isFunction, isNode } from '../emit/ast';
import type { CacheNode, CachePlan, OwnershipResult, Range, ScopeResult, SlotBlock } from '../ir';
import type { Context } from './baseline';
import { createContext, getRange, isInside, pushChildren, walkNodes } from './baseline';

const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'ChainExpression',
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

// Operators that can run user code through a getter or a proxy trap.
const COSTLY_OPERATORS = new Set(['in', 'instanceof']);

function isCheapList(nodes: AstNode[]): boolean {
  for (const node of nodes) {
    if (!isCheap(node)) {
      return false;
    }
  }
  return true;
}

function isCheapChildren(node: AstNode, keys: string[]): boolean {
  for (const key of keys) {
    const child = getChild(node, key);
    if (!child || !isCheap(child)) {
      return false;
    }
  }
  return true;
}

/**
 * True when computing the expression costs no more than one slot compare: literals, names,
 * arithmetic, comparisons, property reads and template strings of those. Calls, `new`, JSX
 * and object, array and function literals are not cheap.
 */
export function isCheap(node: AstNode): boolean {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      return true;
    case 'TemplateLiteral':
      return isCheapList(getChildren(node, 'expressions'));
    case 'UnaryExpression':
      return node.operator !== 'delete' && isCheapChildren(node, ['argument']);
    case 'BinaryExpression':
      return (
        !COSTLY_OPERATORS.has(typeof node.operator === 'string' ? node.operator : '') &&
        isCheapChildren(node, ['left', 'right'])
      );
    case 'LogicalExpression':
      return isCheapChildren(node, ['left', 'right']);
    case 'ConditionalExpression':
      return isCheapChildren(node, ['test', 'consequent', 'alternate']);
    case 'MemberExpression':
      // A computed key is an expression of its own.
      return isCheapChildren(node, node.computed === true ? ['object', 'property'] : ['object']);
    default:
      return WRAPPERS.has(node.type) && isCheapChildren(node, ['expression']);
  }
}

function isComponentElement(node: AstNode): boolean {
  if (node.type !== 'JSXElement') {
    return false;
  }
  const opening = getChild(node, 'openingElement');
  const name = opening && getChild(opening, 'name');
  if (name?.type === 'JSXMemberExpression') {
    return true;
  }
  return (
    name?.type === 'JSXIdentifier' && typeof name.name === 'string' && /^[A-Z]/.test(name.name)
  );
}

function isStrictlyInside(inner: Range, outer: Range): boolean {
  return isInside(inner, outer) && (inner.start !== outer.start || inner.end !== outer.end);
}

/** A block with fewer inputs costs only a few compares and slots, so it stays. */
const MIN_INPUTS = 4;

const CALLS = new Set(['CallExpression', 'NewExpression', 'TaggedTemplateExpression']);

/** True when a component element or a call sits in the node, outside the holes. */
function hasComponent(root: AstNode, holes: Range[]): boolean {
  const stack: AstNode[] = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    const range = getRange(node);
    let isHole = false;
    for (const hole of holes) {
      isHole ||= isInside(range, hole);
    }
    if (isHole) {
      continue;
    }
    if (isComponentElement(node) || CALLS.has(node.type)) {
      return true;
    }
    // A closure runs later, so its calls cost nothing now, but a component in it may.
    if (isFunction(node)) {
      if (!walkNodes(node, (item) => !isComponentElement(item))) {
        return true;
      }
      continue;
    }
    pushChildren(node, stack);
  }
  return false;
}

const PASS_THROUGH = new Set([
  'JSXElement',
  'JSXFragment',
  'JSXExpressionContainer',
  'JSXAttribute',
  'JSXOpeningElement',
  'ParenthesizedExpression',
  'ConditionalExpression',
  'LogicalExpression',
]);

function enclosesUnit(ctx: Context, node: AstNode): boolean {
  for (let parent = ctx.index.parents.get(node); parent; parent = ctx.index.parents.get(parent)) {
    if (
      parent.type === 'FunctionDeclaration' ||
      parent.type === 'FunctionExpression' ||
      parent.type === 'ArrowFunctionExpression'
    ) {
      return parent.start === ctx.unitRange.start && parent.end === ctx.unitRange.end;
    }
  }
  return false;
}

/**
 * True when the value only flows into the component's returned tree through host elements,
 * so no component receives it as a prop or a child.
 */
function isHostReturn(ctx: Context, start: AstNode): boolean {
  let child = start;
  for (let parent = ctx.index.parents.get(child); parent; parent = ctx.index.parents.get(child)) {
    if (parent.type === 'ReturnStatement') {
      return enclosesUnit(ctx, parent);
    }
    if (parent.type === 'ArrowFunctionExpression') {
      return getChild(parent, 'body') === child && getRange(parent).start === ctx.unitRange.start;
    }
    if (!PASS_THROUGH.has(parent.type) || isComponentElement(parent)) {
      return false;
    }
    child = parent;
  }
  return false;
}

function findOutputNode(ctx: Context, range: Range): AstNode | undefined {
  try {
    return findExact(ctx.index, range);
  } catch {
    return undefined;
  }
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

/** The ids of the blocks of a node that cache a host-only tree nobody hands to a component. */
function findUselessBlocks(ctx: Context, node: CacheNode): Set<number> {
  const holes: Range[] = [];
  for (const block of node.blocks) {
    for (const output of block.outputs) {
      holes.push(output.range);
    }
  }
  for (const child of node.children) {
    holes.push(child.range);
  }
  const useless = new Set<number>();
  for (const block of node.blocks) {
    let isUseless = block.kind === 'value' && block.inputs.length >= MIN_INPUTS;
    for (const output of block.outputs) {
      const target = isUseless ? findOutputNode(ctx, output.range) : undefined;
      const inner: Range[] = [];
      for (const hole of holes) {
        if (isStrictlyInside(hole, output.range)) {
          inner.push(hole);
        }
      }
      isUseless = target !== undefined && !hasComponent(target, inner) && isHostReturn(ctx, target);
    }
    if (isUseless) {
      useless.add(block.id);
    }
  }

  // A block that stays reads the outputs it lists, so those blocks stay too.
  for (let changed = true; changed;) {
    changed = false;
    for (const block of node.blocks) {
      if (useless.has(block.id)) {
        continue;
      }
      for (const input of block.inputs) {
        if (input.kind === 'output' && useless.delete(input.block)) {
          changed = true;
        }
      }
    }
  }
  return useless;
}

function pruneNode(ctx: Context, node: CacheNode): void {
  let changed = false;
  const children: CacheNode[] = [];
  for (const child of node.children) {
    if (child.kind === 'branch') {
      pruneNode(ctx, child);
      if (child.blocks.length === 0 && child.children.length === 0) {
        changed = true;
        continue;
      }
    }
    children.push(child);
  }
  node.children = children;
  const useless = findUselessBlocks(ctx, node);
  if (useless.size > 0) {
    changed = true;
    node.blocks = node.blocks.filter((block) => !useless.has(block.id));
  }
  if (changed) {
    layoutNode(node);
  }
}

/**
 * A block that caches a tree of host elements saves no render and no call: React reconciles
 * host nodes for free, and every component inside has a block of its own. Such a block costs
 * its inputs, so it is removed unless a component receives the element.
 */
export function runPrune(
  scope: ScopeResult,
  ownership: OwnershipResult,
  plan: CachePlan,
): CachePlan {
  const unit = scope.units.find((item) => item.id === plan.unit);
  const node: unknown = unit?.node;
  if (unit?.kind !== 'component' || !isNode(node)) {
    return plan;
  }
  const ctx = createContext(scope, ownership, getRange(node));
  if (!ctx) {
    return plan;
  }
  const next = structuredClone(plan);
  pruneNode(ctx, next.root);
  return next;
}
