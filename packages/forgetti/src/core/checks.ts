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

/** Check whether a Node is CallExpression and a React Hook call */
export function isCallExpressionAndHook(ctx: StateContext, node: t.Node): node is t.CallExpression {
  if (node.type !== 'CallExpression') {
    return false;
  }

  // A simple check to see if "node.callee" is an Identifier
  // TypeScript is able to infer the type of "node.callee" to Identifier or V8IntrinsicIdentifier
  if (!('name' in node.callee)) {
    return false;
  }

  // Check if callee is a react hook
  if (!ctx.filters.hook) {
    return false;
  }
  return ctx.filters.hook.test(node.callee.name);
}
