import * as t from '@babel/types';
import { isPathValid } from './checks';

type TypeFilter<V extends t.Node> = (node: t.Node) => node is V;

export default function unwrapPath<V extends t.Node>(
  path: unknown,
  key: TypeFilter<V>,
): babel.NodePath<V> | undefined {
  if (isPathValid(path, key)) {
    return path;
  }
  if (isPathValid(path, t.isParenthesizedExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTypeCastExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTSAsExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTSSatisfiesExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTSNonNullExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTSTypeAssertion)) {
    return unwrapPath(path.get('expression'), key);
  }
  if (isPathValid(path, t.isTSInstantiationExpression)) {
    return unwrapPath(path.get('expression'), key);
  }
  return undefined;
}
