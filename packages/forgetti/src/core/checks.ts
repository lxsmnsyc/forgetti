import * as t from '@babel/types';
import * as babel from '@babel/core';
import { ComponentNode, StateContext } from './types';

export function isComponentishName(name: string) {
  return name[0] >= 'A' && name[0] <= 'Z';
}

export function isHookishName(name: string) {
  return /^use[A-Z]/.test(name);
}

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
    if (ctx.opts.shouldCheckComponentName) {
      return false;
    }
    if (t.isFunctionExpression(node) || t.isFunctionDeclaration(node)) {
      return (node.id && isComponentishName(node.id.name));
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
