import * as t from '@babel/types';

type TypeCheck<K> =
  K extends (node: t.Node) => node is (infer U extends t.Node)
    ? U
    : never;

type TypeFilter = (node: t.Node) => boolean;

export default function unwrapNode<K extends TypeFilter>(
  node: t.Node,
  key: K,
): TypeCheck<K> | undefined {
  if (key(node)) {
    return node as TypeCheck<K>;
  }
  if (
    t.isParenthesizedExpression(node)
    || t.isTypeCastExpression(node)
    || t.isTSAsExpression(node)
    || t.isTSSatisfiesExpression(node)
    || t.isTSNonNullExpression(node)
    || t.isTSTypeAssertion(node)
    || t.isTSInstantiationExpression(node)
  ) {
    return unwrapNode(node.expression, key);
  }
  return undefined;
}
