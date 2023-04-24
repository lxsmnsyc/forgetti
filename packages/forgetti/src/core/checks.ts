import * as t from '@babel/types';
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

export function isComponentNameValid(
  ctx: StateContext,
  node: ComponentNode,
  checkName: boolean,
): boolean {
  if (checkName) {
    if (node.type !== 'ArrowFunctionExpression') {
      return (
        !!node.id
        && (
          ctx.filters.component.test(node.id.name)
          || (!!ctx.filters.hook && ctx.filters.hook.test(node.id.name))
        )
      );
    }
    return false;
  }
  return true;
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
  return t.isParenthesizedExpression(node)
    || t.isTypeCastExpression(node)
    || t.isTSAsExpression(node)
    || t.isTSSatisfiesExpression(node)
    || t.isTSNonNullExpression(node)
    || t.isTSTypeAssertion(node)
    || t.isTSInstantiationExpression(node);
}
