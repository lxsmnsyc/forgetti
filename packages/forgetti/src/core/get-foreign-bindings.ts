import type * as babel from '@babel/core';
import * as t from '@babel/types';

function isForeignBinding(
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

export default function getForeignBindings(path: babel.NodePath): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    Expression(p) {
      // Check identifiers that aren't in a TS expression
      if (
        t.isIdentifier(p.node)
        && !isInTypescript(p)
        && isForeignBinding(path, p, p.node.name)
      ) {
        identifiers.add(p.node.name);
      }
      if (t.isJSXElement(p.node)) {
        if (t.isJSXMemberExpression(p.node.openingElement.name)) {
          let base: t.JSXMemberExpression | t.JSXIdentifier = p.node.openingElement.name;
          while (t.isJSXMemberExpression(base)) {
            base = base.object;
          }
          if (isForeignBinding(path, p, base.name)) {
            identifiers.add(base.name);
          }
        } else if (t.isJSXIdentifier(p.node.openingElement.name)) {
          const literal = p.node.openingElement.name.name;
          if (/^[A-Z]/.test(literal) && isForeignBinding(path, p, literal)) {
            identifiers.add(literal);
          }
        }
      }
    },
  });

  const result: t.Identifier[] = [];
  for (const identifier of identifiers) {
    result.push(t.identifier(identifier));
  }
  return result;
}
