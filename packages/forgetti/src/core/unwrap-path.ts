import * as t from '@babel/types';
import { isPathValid } from './checks';

type TypeCheck<K> =
  K extends (node: t.Node) => node is (infer U extends t.Node)
    ? U
    : never;

type TypeFilter = (node: t.Node) => boolean;

export default function unwrapPath<K extends TypeFilter>(
  path: babel.NodePath,
  key: K,
): babel.NodePath<TypeCheck<K>> | undefined {
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
