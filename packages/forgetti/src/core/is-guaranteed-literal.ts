import * as t from '@babel/types';

export default function isGuaranteedLiteral(node: t.Node): node is t.Literal {
  switch (node.type) {
    case 'BigIntLiteral':
    case 'BooleanLiteral':
    case 'DecimalLiteral':
    case 'NullLiteral':
    case 'NumericLiteral':
    case 'RegExpLiteral':
    case 'StringLiteral':
      return true;
    case 'TemplateLiteral': {
      let expr: t.Expression | t.TSType;
      for (let i = 0, len = node.expressions.length; i < len; i++) {
        expr = node.expressions[i];
        if (t.isExpression(expr)) {
          if (!isGuaranteedLiteral(expr)) {
            return false;
          }
        } else {
          return false;
        }
      }
      return true;
    }
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
    case 'TSInstantiationExpression':
      return isGuaranteedLiteral(node.expression);
    case 'UnaryExpression':
      switch (node.operator) {
        case 'throw':
        case 'delete':
          return false;
        default:
          return isGuaranteedLiteral(node.argument);
      }
    case 'ConditionalExpression':
      return isGuaranteedLiteral(node.test)
        && isGuaranteedLiteral(node.consequent)
        && isGuaranteedLiteral(node.alternate);
    case 'BinaryExpression':
      if (node.operator === '|>') {
        return false;
      }
      if (t.isExpression(node.left)) {
        return isGuaranteedLiteral(node.left);
      }
      if (t.isExpression(node.right)) {
        return isGuaranteedLiteral(node.right);
      }
      return false;
    case 'LogicalExpression':
      return isGuaranteedLiteral(node.left) && isGuaranteedLiteral(node.right);
    default:
      return false;
  }
}
