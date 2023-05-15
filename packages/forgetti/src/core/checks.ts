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

export function isHookOrComponentName(ctx: StateContext, id: t.Identifier): boolean {
  return ctx.filters.component.test(id.name) || isHookName(ctx, id);
}

export function isComponentNameValid(
  ctx: StateContext,
  node: ComponentNode,
  checkName: boolean,
): boolean {
  return !checkName || (
    node.type !== 'ArrowFunctionExpression'
    && !!node.id
    && isHookOrComponentName(ctx, node.id)
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
