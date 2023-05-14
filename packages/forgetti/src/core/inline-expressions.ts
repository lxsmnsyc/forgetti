/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type * as babel from '@babel/core';
import type { ComponentNode } from './types';

function isInConditional(path: babel.NodePath): boolean {
  let current = path.parentPath;
  let prev = path;
  while (current) {
    if (
      current.isConditionalExpression()
      && (
        current.get('consequent').node === prev.node
        || current.get('alternate').node === prev.node
      )
    ) {
      return true;
    }
    prev = current;
    current = current.parentPath;
  }
  return false;
}

export function inlineExpressions(
  path: babel.NodePath<ComponentNode>,
): void {
  path.traverse({
    Expression(p) {
      if (p.getFunctionParent() === path && p.isIdentifier()) {
        const binding = p.scope.getBinding(p.node.name);
        if (binding && binding.referenced && binding.referencePaths.length === 1) {
          switch (binding.kind) {
            case 'const':
            case 'let':
            case 'var': {
              // move the node to the reference
              const ref = binding.referencePaths[0];
              if (
                binding.path.isVariableDeclarator()
                && binding.path.get('id').isIdentifier()
                && binding.path.scope.getBlockParent() === ref.scope.getBlockParent()
                && binding.path.node.init
                && !isInConditional(ref)
              ) {
                ref.replaceWith(binding.path.node.init);
                binding.path.remove();
              }
            }
              break;
            default:
              break;
          }
        }
      }
    },
  });
}
