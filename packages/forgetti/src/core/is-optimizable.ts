import type * as t from '@babel/types';
import type * as babel from '@babel/core';

export default function isOptimizable(
  path: babel.NodePath,
  node: t.Expression,
): boolean {
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'TSInstantiationExpression':
      return isOptimizable(path, node.expression);
    case 'Identifier': {
      if (node.name === 'process') {
        const identifier = path.scope.getBindingIdentifier(node.name);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!identifier) {
          return false;
        }
      }
      return true;
    }
    case 'MetaProperty':
      return false;
    case 'MemberExpression':
      return isOptimizable(path, node.object);
    default:
      return true;
  }
}
