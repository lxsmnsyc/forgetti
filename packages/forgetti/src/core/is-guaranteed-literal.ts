import * as t from '@babel/types';
import { every } from './arrays';
import { isNestedExpression } from './checks';

export default function isGuaranteedLiteral(node: t.Node): node is t.Literal {
  if (t.isLiteral(node)) {
    // Check if it is template literal but with only static expressions
    if (t.isTemplateLiteral(node)) {
      return every(node.expressions, (expr) => {
        if (t.isExpression(expr)) {
          return isGuaranteedLiteral(expr);
        }
        return false;
      });
    }
    return true;
  }
  if (isNestedExpression(node)) {
    return isGuaranteedLiteral(node.expression);
  }
  if (t.isUnaryExpression(node)) {
    if (node.operator === 'throw' || node.operator === 'delete') {
      return false;
    }
    return isGuaranteedLiteral(node.argument);
  }
  if (t.isConditionalExpression(node)) {
    return isGuaranteedLiteral(node.test)
      || isGuaranteedLiteral(node.consequent)
      || isGuaranteedLiteral(node.alternate);
  }
  if (t.isBinaryExpression(node)) {
    if (node.operator === 'in' || node.operator === 'instanceof' || node.operator === '|>') {
      return false;
    }
    if (t.isExpression(node.left)) {
      return isGuaranteedLiteral(node.left);
    }
    if (t.isExpression(node.right)) {
      return isGuaranteedLiteral(node.right);
    }
    return false;
  }
  if (t.isLogicalExpression(node)) {
    return isGuaranteedLiteral(node.left) || isGuaranteedLiteral(node.right);
  }
  return false;
}
