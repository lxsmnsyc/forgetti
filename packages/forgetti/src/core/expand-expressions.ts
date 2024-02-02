import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isPathValid } from './utils/checks';
import { getHookCallType } from './utils/get-hook-call-type';
import type { ComponentNode, StateContext } from './types';
import unwrapNode from './utils/unwrap-node';

function isStatementValid(path: babel.NodePath): boolean {
  if (path) {
    switch (path.node.type) {
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        return false;
      default:
        return true;
    }
  }
  return false;
}

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

const UNDEFINED_LITERAL = t.unaryExpression('void', t.numericLiteral(0));

function transformOptionalCall(
  path: babel.NodePath<t.OptionalCallExpression>,
): t.Expression {
  const unwrappedID = unwrapNode(path.node.callee, t.isIdentifier);
  if (unwrappedID) {
    return t.conditionalExpression(
      t.binaryExpression('==', unwrappedID, t.nullLiteral()),
      UNDEFINED_LITERAL,
      t.callExpression(unwrappedID, path.node.arguments),
    );
  }
  const temp = path.scope.generateUidIdentifier('nullish');
  path.scope.push({
    kind: 'let',
    id: temp,
  });
  const unwrappedCallee =
    unwrapNode(path.node.callee, t.isMemberExpression) ||
    unwrapNode(path.node.callee, t.isOptionalMemberExpression);
  if (unwrappedCallee) {
    let unwrappedObject = unwrapNode(unwrappedCallee.object, t.isIdentifier);
    if (!unwrappedObject) {
      unwrappedObject = path.scope.generateUidIdentifier('object');
      path.scope.push({
        kind: 'let',
        id: unwrappedObject,
      });
      unwrappedCallee.object = t.assignmentExpression(
        '=',
        unwrappedObject,
        unwrappedCallee.object,
      );
    }
    return t.conditionalExpression(
      t.binaryExpression(
        '==',
        t.assignmentExpression('=', temp, unwrappedCallee),
        t.nullLiteral(),
      ),
      UNDEFINED_LITERAL,
      t.callExpression(t.memberExpression(temp, t.identifier('call')), [
        unwrappedObject,
        ...path.node.arguments,
      ]),
    );
  }
  return t.conditionalExpression(
    t.binaryExpression(
      '==',
      t.assignmentExpression('=', temp, path.node.callee),
      t.nullLiteral(),
    ),
    UNDEFINED_LITERAL,
    t.callExpression(temp, path.node.arguments),
  );
}

function transformOptionalMember(
  path: babel.NodePath<t.OptionalMemberExpression>,
): t.Expression {
  const unwrappedID = unwrapNode(path.node.object, t.isIdentifier);
  if (unwrappedID) {
    return t.conditionalExpression(
      t.binaryExpression('==', unwrappedID, t.nullLiteral()),
      UNDEFINED_LITERAL,
      t.memberExpression(unwrappedID, path.node.property, path.node.computed),
    );
  }
  const temp = path.scope.generateUidIdentifier('nullish');
  path.scope.push({
    kind: 'let',
    id: temp,
  });
  return t.conditionalExpression(
    t.binaryExpression(
      '==',
      t.assignmentExpression('=', temp, path.node.object),
      t.nullLiteral(),
    ),
    UNDEFINED_LITERAL,
    t.memberExpression(temp, path.node.property, path.node.computed),
  );
}

export function expandExpressions(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  if (
    path.node.type === 'ArrowFunctionExpression' &&
    path.node.body.type !== 'BlockStatement'
  ) {
    path.node.body = t.blockStatement([t.returnStatement(path.node.body)]);
  }
  path.traverse({
    OptionalCallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (parent === path && statement) {
        p.replaceWith(transformOptionalCall(p));
      }
    },
    OptionalMemberExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (parent === path && statement) {
        p.replaceWith(transformOptionalMember(p));
      }
    },
    AssignmentExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path &&
        statement &&
        isStatementValid(statement) &&
        isInValidExpression(p) &&
        !isPathValid(p.parentPath, t.isStatement) &&
        !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const id = p.scope.generateUidIdentifier('hoisted');
        statement.scope.registerDeclaration(
          statement.insertBefore(
            t.variableDeclaration('let', [t.variableDeclarator(id, p.node)]),
          )[0],
        );
        p.replaceWith(id);
      }
    },
    CallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path &&
        statement &&
        !isPathValid(p.parentPath, t.isStatement) &&
        !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const hookType = getHookCallType(ctx, p);
        if (hookType === 'custom' || hookType === 'effect') {
          const id = p.scope.generateUidIdentifier('hoisted');
          statement.scope.registerDeclaration(
            statement.insertBefore(
              t.variableDeclaration('let', [t.variableDeclarator(id, p.node)]),
            )[0],
          );
          p.replaceWith(id);
        }
      }
    },
  });
}
