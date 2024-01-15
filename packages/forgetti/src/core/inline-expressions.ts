import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { ComponentNode } from './types';
import { isPathValid } from './checks';

function isInValidExpression(path: babel.NodePath): boolean {
  let current = path.parentPath;
  let prev = path;
  while (current) {
    if (
      isPathValid(current, t.isConditionalExpression) &&
      (current.get('consequent').node === prev.node ||
        current.get('alternate').node === prev.node)
    ) {
      return false;
    }
    if (
      isPathValid(current, t.isLogicalExpression) &&
      current.get('right').node === prev.node
    ) {
      return false;
    }
    prev = current;
    current = current.parentPath;
  }
  return true;
}

function inlineExpression(
  parentPath: babel.NodePath<ComponentNode>,
  path: babel.NodePath<t.Expression>,
) {
  if (
    path.getFunctionParent() === parentPath &&
    isPathValid(path, t.isIdentifier)
  ) {
    const binding = path.scope.getBinding(path.node.name);
    if (binding?.referenced && binding.referencePaths.length === 1) {
      switch (binding.kind) {
        case 'const':
        case 'let':
        case 'var': {
          // move the node to the reference
          const ref = binding.referencePaths[0];
          if (
            isInValidExpression(ref) &&
            isPathValid(binding.path, t.isVariableDeclarator) &&
            binding.path.node.init &&
            isPathValid(binding.path.get('id'), t.isIdentifier) &&
            binding.path.scope.getBlockParent() === ref.scope.getBlockParent()
          ) {
            ref.replaceWith(binding.path.node.init);
            binding.path.remove();
          }
          break;
        }
      }
    }
  }
}

export function inlineExpressions(path: babel.NodePath<ComponentNode>): void {
  path.traverse({
    Expression(p) {
      inlineExpression(path, p);
    },
  });
  path.scope.crawl();
}
