import type { AstNode } from '../emit/ast';
import { getChild, getChildren } from '../emit/ast';

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
