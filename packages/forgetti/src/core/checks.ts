import * as t from '@babel/types';
import * as babel from '@babel/core';
import { ComponentNode, StateContext } from './types';

export function isValidImportSpecifier(
  specifier: t.ImportSpecifier,
  name: string,
): boolean {
  return (
    (t.isIdentifier(specifier.imported) && specifier.imported.name === name)
    || (t.isStringLiteral(specifier.imported) && specifier.imported.value === name)
  );
}

export function isComponent(node: t.Node): node is ComponentNode {
  return (
    t.isArrowFunctionExpression(node)
    || t.isFunctionExpression(node)
    || t.isFunctionDeclaration(node)
  );
}

export function isComponentNameValid(
  ctx: StateContext,
  node: ComponentNode,
  checkName = false,
) {
  if (checkName) {
    if (t.isFunctionExpression(node) || t.isFunctionDeclaration(node)) {
      return (node.id && ctx.filters.component.test(node.id.name));
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
