/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { ComponentNode, StateContext } from './types';
import { isPathValid } from './checks';
import unwrapNode from './unwrap-node';

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
      current.isConditionalExpression()
      && (
        current.get('consequent').node === prev.node
        || current.get('alternate').node === prev.node
      )
    ) {
      return false;
    }
    if (
      current.isLogicalExpression()
      && current.get('right').node === prev.node
    ) {
      return false;
    }
    prev = current;
    current = current.parentPath;
  }
  return true;
}

export function expandExpressions(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  if (path.node.type === 'ArrowFunctionExpression') {
    if (path.node.body.type !== 'BlockStatement') {
      path.node.body = t.blockStatement(
        [t.returnStatement(path.node.body)],
      );
    }
  }

  const hoistedVars = new Set();

  path.traverse({
    AssignmentExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && isStatementValid(statement)
        && isInValidExpression(p)
        && !(
          p.parentPath.isVariableDeclarator()
          && p.parentPath.node.id.type === 'Identifier'
          && hoistedVars.has(p.parentPath.node.id.name)
        )
      ) {
        const id = p.scope.generateUidIdentifier('hoisted');
        hoistedVars.add(id.name);
        statement.insertBefore(
          t.variableDeclaration(
            'let',
            [t.variableDeclarator(id, p.node)],
          ),
        );
        p.replaceWith(id);
      }
    },
    CallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (parent === path && statement && isStatementValid(statement)) {
        if (
          p.parentPath.isVariableDeclarator()
          && p.parentPath.node.id.type === 'Identifier'
          && hoistedVars.has(p.parentPath.node.id.name)
        ) {
          return;
        }
        const calleePath = p.get('callee');
        if (isPathValid(calleePath, t.isExpression)) {
          let isHook = false;
          const trueID = unwrapNode(calleePath.node, t.isIdentifier);
          if (trueID) {
            const binding = p.scope.getBindingIdentifier(trueID.name);
            if (binding) {
              const registration = ctx.registrations.hooks.get(binding);
              if (registration) {
                isHook = true;
              }
            }
            if (ctx.filters.hook?.test(trueID.name)) {
              isHook = true;
            }
            // Check if callee is potentially a namespace import
          }
          const trueMember = unwrapNode(calleePath.node, t.isMemberExpression);
          if (
            trueMember
            && !trueMember.computed
            && t.isIdentifier(trueMember.property)
          ) {
            const obj = unwrapNode(trueMember.object, t.isIdentifier);
            if (obj) {
              const binding = path.scope.getBindingIdentifier(obj.name);
              if (binding) {
                const registrations = ctx.registrations.hooksNamespaces.get(binding);
                if (registrations) {
                  let registration: typeof registrations[0];
                  for (let i = 0, len = registrations.length; i < len; i += 1) {
                    registration = registrations[i];
                    if (registration.name === trueMember.property.name) {
                      isHook = true;
                    }
                  }
                }
              }
            }
            if (ctx.filters.hook?.test(trueMember.property.name)) {
              isHook = true;
            }
          }

          if (isHook) {
            const id = p.scope.generateUidIdentifier('hoisted');
            hoistedVars.add(id.name);
            statement.insertBefore(
              t.variableDeclaration(
                'let',
                [t.variableDeclarator(id, p.node)],
              ),
            );
            p.replaceWith(id);
          }
        }
      }
    },
  });

  path.scope.crawl();
}
