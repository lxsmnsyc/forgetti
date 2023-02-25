import * as babel from '@babel/core';
import * as t from '@babel/types';
import { map } from './arrays';

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
      // for the JSX, only use JSXMemberExpression's object
      // as a foreign binding
      if (t.isJSXElement(p.node) && t.isJSXMemberExpression(p.node.openingElement.name)) {
        let base: t.JSXMemberExpression | t.JSXIdentifier = p.node.openingElement.name;
        while (t.isJSXMemberExpression(base)) {
          base = base.object;
        }
        if (isForeignBinding(path, p, base.name)) {
          identifiers.add(base.name);
        }
      }
    },
  });

  return map([...identifiers], (value) => t.identifier(value));
}
