import type * as babel from '@babel/core';
import * as t from '@babel/types';

export function isForeignBinding(
  source: babel.NodePath,
  current: babel.NodePath,
  name: string,
): boolean {
  if (current.scope.hasGlobal(name)) {
    return false;
  }
  if (source === current) {
    return true;
  }
  if (current.scope.hasOwnBinding(name)) {
    return false;
  }
  if (current.parentPath) {
    return isForeignBinding(source, current.parentPath, name);
  }
  return true;
}

function isInTypescript(path: babel.NodePath): boolean {
  let parent = path.parentPath;
  while (parent) {
    if (t.isTypeScript(parent.node) && !t.isExpression(parent.node)) {
      return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

function getForeignBindingsFromExpression(
  parentPath: babel.NodePath,
  path: babel.NodePath<t.Identifier | t.JSXIdentifier>,
  identifiers: Set<string>,
) {
  // Check identifiers that aren't in a TS expression
  if (
    !isInTypescript(path) &&
    isForeignBinding(parentPath, path, path.node.name)
  ) {
    identifiers.add(path.node.name);
  }
}

export default function getForeignBindings(
  path: babel.NodePath,
): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    ReferencedIdentifier(p) {
      getForeignBindingsFromExpression(path, p, identifiers);
    },
  });

  const result: t.Identifier[] = [];
  for (const identifier of identifiers) {
    result.push(t.identifier(identifier));
  }
  return result;
}
