import * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { ComponentNode } from './types';

type LiteralState = 'truthy' | 'falsy' | 'nullish' | 'indeterminate';

function getBooleanishState(node: t.Expression): LiteralState {
  switch (node.type) {
    case 'BooleanLiteral':
      return node.value ? 'truthy' : 'falsy';
    case 'NumericLiteral':
      return node.value === 0 ? 'falsy' : 'truthy';
    case 'NullLiteral':
      return 'nullish';
    case 'StringLiteral':
      return node.value === '' ? 'falsy' : 'truthy';
    case 'BigIntLiteral':
      return node.value === '0' ? 'falsy' : 'truthy';
    case 'Identifier': {
      switch (node.name) {
        case 'NaN':
          return 'falsy';
        case 'undefined':
          return 'nullish';
        default:
          return 'indeterminate';
      }
    }
    case 'ArrayExpression':
    case 'ArrowFunctionExpression':
    case 'RegExpLiteral':
    case 'ObjectExpression':
    case 'RecordExpression':
    case 'TupleExpression':
      return 'truthy';
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'TSInstantiationExpression':
      return getBooleanishState(node.expression);
    default:
      return 'indeterminate';
  }
}

export function simplifyExpressions(path: babel.NodePath<ComponentNode>): void {
  path.traverse({
    ConditionalExpression: {
      exit(p) {
        switch (getBooleanishState(p.node.test)) {
          case 'nullish':
          case 'falsy':
            p.replaceWith(p.node.alternate);
            break;
          case 'truthy':
            p.replaceWith(p.node.consequent);
            break;
          default:
            break;
        }
      },
    },
    LogicalExpression: {
      exit(p) {
        switch (getBooleanishState(p.node.left)) {
          case 'nullish':
            p.replaceWith(
              p.node.operator === '??'
                ? p.node.right
                : p.node.left,
            );
            break;
          case 'falsy':
            switch (p.node.operator) {
              case '||':
                p.replaceWith(p.node.right);
                break;
              default:
                p.replaceWith(p.node.left);
                break;
            }
            break;
          case 'truthy':
            switch (p.node.operator) {
              case '&&':
                p.replaceWith(p.node.right);
                break;
              default:
                p.replaceWith(p.node.left);
                break;
            }
            break;
          default:
            break;
        }
      },
    },
    UnaryExpression: {
      exit(p) {
        switch (p.node.operator) {
          case 'void':
            p.replaceWith(t.identifier('undefined'));
            break;
          case '!':
            switch (getBooleanishState(p.node.argument)) {
              case 'truthy':
                p.replaceWith(t.booleanLiteral(false));
                break;
              case 'falsy':
              case 'nullish':
                p.replaceWith(t.booleanLiteral(true));
                break;
              default:
                break;
            }
            break;
          default:
            break;
        }
      },
    },
  });
  path.scope.crawl();
}
