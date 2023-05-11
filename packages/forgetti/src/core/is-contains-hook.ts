/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-use-before-define */
import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isNestedExpression, isPathValid } from './checks';
import type OptimizerScope from './optimizer-scope';
import type { ComponentNode, StateContext } from './types';
import unwrapNode from './unwrap-node';

interface OptimizerInstance {
  ctx: StateContext;
  scope: OptimizerScope;
  path: babel.NodePath<ComponentNode>;
}

function isTemplateLiteralContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.TemplateLiteral>,
): boolean {
  const expressions = path.get('expressions');
  for (let i = 0, len = expressions.length; i < len; i++) {
    const expr = expressions[i];
    if (isPathValid(expr, t.isExpression) && isContainsHook(instance, expr)) {
      return true;
    }
  }
  return false;
}

function isConditionalExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ConditionalExpression>,
): boolean {
  return isContainsHook(instance, path.get('test'));
}

function isBinaryExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.BinaryExpression>,
): boolean {
  const left = path.get('left');
  if (isPathValid(left, t.isExpression) && isContainsHook(instance, left)) {
    return true;
  }
  const right = path.get('right');
  if (isPathValid(right, t.isExpression) && isContainsHook(instance, right)) {
    return true;
  }
  return false;
}

function isLogicalExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.LogicalExpression>,
): boolean {
  return isContainsHook(instance, path.get('left')) || isContainsHook(instance, path.get('right'));
}

function isUnaryExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.UnaryExpression>,
): boolean {
  return isContainsHook(instance, path.get('argument'));
}

function isCallExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
): boolean {
  const callee = path.get('callee');

  if (isPathValid(callee, t.isExpression)) {
    const trueID = unwrapNode(callee.node, t.isIdentifier);
    if (trueID) {
      const binding = path.scope.getBindingIdentifier(trueID.name);
      if (binding) {
        const registration = instance.ctx.registrations.hooks.get(binding);
        if (registration) {
          return false;
        }
        if (instance.ctx.filters.hook?.test(trueID.name)) {
          return true;
        }
      }
    }
    const trueMember = unwrapNode(callee.node, t.isMemberExpression);
    if (
      trueMember
      && !trueMember.computed
      && t.isIdentifier(trueMember.property)
    ) {
      const obj = unwrapNode(trueMember.object, t.isIdentifier);
      if (obj) {
        const binding = path.scope.getBindingIdentifier(obj.name);
        if (binding) {
          const registrations = instance.ctx.registrations.hooksNamespaces.get(binding);
          if (registrations) {
            for (let i = 0, len = registrations.length; i < len; i += 1) {
              const registration = registrations[i];
              if (registration.name === trueMember.property.name) {
                return false;
              }
            }
          }
        }
      }
      if (instance.ctx.filters.hook?.test(trueMember.property.name)) {
        return true;
      }
    }
    if (isContainsHook(instance, callee)) {
      return true;
    }
  }
  const args = path.get('arguments');
  for (let i = 0, len = args.length; i < len; i++) {
    const arg = args[i];
    if (isPathValid(arg, t.isExpression) && isContainsHook(instance, arg)) {
      return true;
    }
    if (isPathValid(arg, t.isSpreadElement) && isContainsHook(instance, arg.get('argument'))) {
      return true;
    }
  }
  return false;
}

function isArrayExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ArrayExpression | t.TupleExpression>,
): boolean {
  const elements = path.get('elements');
  for (let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i];
    if (isPathValid(element, t.isSpreadElement) && isContainsHook(instance, element.get('argument'))) {
      return true;
    }
    if (isPathValid(element, t.isExpression) && isContainsHook(instance, element)) {
      return true;
    }
  }
  return false;
}

function isObjectExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ObjectExpression | t.RecordExpression>,
): boolean {
  const properties = path.get('properties');
  for (let i = 0, len = properties.length; i < len; i++) {
    const property = properties[i];
    if (isPathValid(property, t.isSpreadElement) && isContainsHook(instance, property.get('argument'))) {
      return true;
    }
    if (isPathValid(property, t.isObjectProperty)) {
      if (property.node.computed) {
        const key = property.get('key');
        if (isPathValid(key, t.isExpression) && isContainsHook(instance, key)) {
          return true;
        }
      }
      const value = property.get('value');
      if (isPathValid(value, t.isExpression) && isContainsHook(instance, value)) {
        return true;
      }
    }
  }
  return false;
}

function isSequenceExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.SequenceExpression>,
): boolean {
  const exprs = path.get('expressions');
  for (let i = 0, len = exprs.length; i < len; i++) {
    if (isContainsHook(instance, exprs[i])) {
      return true;
    }
  }
  return false;
}

function isJSXChildrenContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXFragment | t.JSXElement>,
): boolean {
  const children = path.get('children');
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];
    if (isPathValid(child, t.isJSXElement) && isJSXElementContainsHook(instance, child)) {
      return true;
    }
    if (isPathValid(child, t.isJSXFragment) && isJSXChildrenContainsHook(instance, child)) {
      return true;
    }
    if (isPathValid(child, t.isJSXSpreadChild) && isContainsHook(instance, child.get('expression'))) {
      return true;
    }
    if (isPathValid(child, t.isJSXExpressionContainer)) {
      const expr = child.get('expression');
      if (isPathValid(expr, t.isExpression) && isContainsHook(instance, expr)) {
        return true;
      }
    }
  }
  return false;
}

function isJSXElementContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXElement>,
): boolean {
  return isJSXChildrenContainsHook(instance, path);
}

function isAssignmentExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.AssignmentExpression>,
): boolean {
  const left = path.get('left');
  if (isPathValid(left, t.isExpression) && isContainsHook(instance, left)) {
    return true;
  }
  const right = path.get('right');
  if (isPathValid(right, t.isExpression) && isContainsHook(instance, right)) {
    return true;
  }
  return false;
}

function isTaggedTemplateExpressionContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.TaggedTemplateExpression>,
): boolean {
  return isContainsHook(instance, path.get('tag'))
    || isContainsHook(instance, path.get('quasi'));
}

export default function isContainsHook(
  instance: OptimizerInstance,
  path: babel.NodePath<t.Expression>,
): boolean {
  if (isPathValid(path, isNestedExpression)) {
    return isContainsHook(instance, path.get('expression'));
  }
  if (isPathValid(path, t.isLiteral)) {
    if (isPathValid(path, t.isTemplateLiteral)) {
      return isTemplateLiteralContainsHook(instance, path);
    }
    return false;
  }
  if (isPathValid(path, t.isIdentifier)) {
    return false;
  }
  if (isPathValid(path, t.isMemberExpression) || isPathValid(path, t.isOptionalMemberExpression)) {
    return false;
  }
  if (isPathValid(path, t.isConditionalExpression)) {
    return isConditionalExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isBinaryExpression)) {
    return isBinaryExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isLogicalExpression)) {
    return isLogicalExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isUnaryExpression)) {
    return isUnaryExpressionContainsHook(instance, path);
  }
  if (
    isPathValid(path, t.isCallExpression)
    || isPathValid(path, t.isOptionalCallExpression)
  ) {
    return isCallExpressionContainsHook(instance, path);
  }
  if (
    isPathValid(path, t.isFunctionExpression)
    || isPathValid(path, t.isArrowFunctionExpression)
  ) {
    return false;
  }
  if (isPathValid(path, t.isAssignmentExpression)) {
    return isAssignmentExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isArrayExpression) || isPathValid(path, t.isTupleExpression)) {
    return isArrayExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isObjectExpression) || isPathValid(path, t.isRecordExpression)) {
    return isObjectExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isNewExpression)) {
    return false;
  }
  if (isPathValid(path, t.isSequenceExpression)) {
    return isSequenceExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isTaggedTemplateExpression)) {
    return isTaggedTemplateExpressionContainsHook(instance, path);
  }
  if (isPathValid(path, t.isJSXFragment)) {
    return isJSXChildrenContainsHook(instance, path);
  }
  if (isPathValid(path, t.isJSXElement)) {
    return isJSXElementContainsHook(instance, path);
  }
  if (isPathValid(path, t.isImport)) {
    return false;
  }
  if (isPathValid(path, t.isMetaProperty)) {
    return false;
  }
  return false;
}
