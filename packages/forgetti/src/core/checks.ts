import type * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { ComponentNode, StateContext } from './types';

export function getImportSpecifierName(specifier: t.ImportSpecifier): string {
  if (specifier.imported.type === 'Identifier') {
    return specifier.imported.name;
  }
  return specifier.imported.value;
}

export function isComponent(node: t.Node): node is ComponentNode {
  switch (node.type) {
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'FunctionDeclaration':
      return true;
    default:
      return false;
  }
}

export function isHookName(ctx: StateContext, id: t.Identifier): boolean {
  return !!ctx.filters.hook && ctx.filters.hook.test(id.name);
}

export function isHookOrComponentName(
  ctx: StateContext,
  id: t.Identifier,
): boolean {
  return ctx.filters.component.test(id.name) || isHookName(ctx, id);
}

const FORGETTI_SKIP = /^\s*@forgetti skip\s*$/;

export function shouldSkipNode(node: t.Node): boolean {
  // Node without leading comments shouldn't be skipped
  if (node.leadingComments) {
    for (let i = 0, len = node.leadingComments.length; i < len; i++) {
      if (FORGETTI_SKIP.test(node.leadingComments[i].value)) {
        return true;
      }
    }
  }
  return false;
}

const FORGETTI_JSX_SKIP = /^\s*@forgetti jsx\s*$/;

export function shouldSkipJSX(node: t.Node): boolean {
  // Node without leading comments shouldn't be skipped
  if (node.leadingComments) {
    for (let i = 0, len = node.leadingComments.length; i < len; i++) {
      if (FORGETTI_JSX_SKIP.test(node.leadingComments[i].value)) {
        return true;
      }
    }
  }
  return false;
}

export function isComponentValid(
  ctx: StateContext,
  node: ComponentNode,
  checkName: boolean,
): boolean {
  return (
    !checkName ||
    (node.type !== 'ArrowFunctionExpression' &&
      !!node.id &&
      isHookOrComponentName(ctx, node.id) &&
      !shouldSkipNode(node))
  );
}

type TypeFilter<V extends t.Node> = (node: t.Node) => node is V;

export function isPathValid<V extends t.Node>(
  path: unknown,
  key: TypeFilter<V>,
): path is babel.NodePath<V> {
  return key((path as babel.NodePath).node);
}

export type NestedExpression =
  | t.ParenthesizedExpression
  | t.TypeCastExpression
  | t.TSAsExpression
  | t.TSSatisfiesExpression
  | t.TSNonNullExpression
  | t.TSInstantiationExpression
  | t.TSTypeAssertion;

export function isNestedExpression(node: t.Node): node is NestedExpression {
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'TSInstantiationExpression':
      return true;
    default:
      return false;
  }
}
