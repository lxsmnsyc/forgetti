/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-use-before-define */
import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isNestedExpression, isPathValid } from './checks';
import type OptimizerScope from './optimizer-scope';
import getForeignBindings, { isForeignBinding } from './get-foreign-bindings';
import type { ComponentNode, StateContext } from './types';
import unwrapNode from './unwrap-node';

interface OptimizerInstance {
  ctx: StateContext;
  scope: OptimizerScope;
  path: babel.NodePath<ComponentNode>;
}

function isTemplateLiteralConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.TemplateLiteral>,
): boolean {
  const expressions = path.get('expressions');
  for (let i = 0, len = expressions.length; i < len; i++) {
    const expr = expressions[i];
    if (isPathValid(expr, t.isExpression)) {
      if (!isConstant(instance, expr)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

function isIdentifierConstant(
  instance: OptimizerInstance,
  path: babel.NodePath,
  node: t.Identifier,
): boolean {
  switch (node.name) {
    case 'undefined':
    case 'NaN':
    case 'Infinity':
      return true;
    default: {
      if (isForeignBinding(instance.path, path, node.name)) {
        return true;
      }
      const binding = path.scope.getBindingIdentifier(node.name);
      if (binding) {
        return instance.scope.hasConstant(binding);
      }
      return true;
    }
  }
}

function isMemberExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.MemberExpression | t.OptionalMemberExpression>,
): boolean {
  if (isConstant(instance, path.get('object'))) {
    if (path.node.computed) {
      const property = path.get('property');
      if (isPathValid(property, t.isExpression)) {
        return isConstant(instance, property);
      }
    }
    return true;
  }
  return false;
}

function isConditionalExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ConditionalExpression>,
): boolean {
  return isConstant(instance, path.get('test'))
    && isConstant(instance, path.get('consequent'))
    && isConstant(instance, path.get('alternate'));
}

function isBinaryExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.BinaryExpression>,
): boolean {
  const left = path.get('left');
  const right = path.get('right');
  return isPathValid(left, t.isExpression)
    && isConstant(instance, left)
    && isConstant(instance, right);
}

function isLogicalExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.LogicalExpression>,
): boolean {
  return isConstant(instance, path.get('left'))
    && isConstant(instance, path.get('right'));
}

function isUnaryExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.UnaryExpression>,
): boolean {
  switch (path.node.operator) {
    case 'throw':
    case 'delete':
      return false;
    default:
      return isConstant(instance, path.get('argument'));
  }
}

function isCallExpressionConstant(
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
          return false;
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
            let registration: typeof registrations[0];
            for (let i = 0, len = registrations.length; i < len; i += 1) {
              registration = registrations[i];
              if (registration.name === trueMember.property.name) {
                return false;
              }
            }
          }
        }
      }
      if (instance.ctx.filters.hook?.test(trueMember.property.name)) {
        return false;
      }
    }
    if (!isConstant(instance, callee)) {
      return false;
    }
  }
  const args = path.get('arguments');
  for (let i = 0, len = args.length; i < len; i++) {
    const arg = args[i];
    if (isPathValid(arg, t.isExpression) && !isConstant(instance, arg)) {
      return false;
    }
    if (isPathValid(arg, t.isSpreadElement) && !isConstant(instance, arg.get('argument'))) {
      return false;
    }
  }
  return true;
}

function isFunctionExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.FunctionExpression | t.ArrowFunctionExpression>,
): boolean {
  const bindings = getForeignBindings(path);
  for (let i = 0, len = bindings.length; i < len; i++) {
    const binding = bindings[i];
    if (!isIdentifierConstant(instance, path, binding)) {
      return false;
    }
  }
  return true;
}

function isArrayExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ArrayExpression | t.TupleExpression>,
): boolean {
  const elements = path.get('elements');
  for (let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i];
    if (isPathValid(element, t.isSpreadElement)) {
      if (!isConstant(instance, element.get('argument'))) {
        return false;
      }
    }
    if (isPathValid(element, t.isExpression)) {
      if (!isConstant(instance, element)) {
        return false;
      }
    }
  }
  return true;
}

function isObjectExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.ObjectExpression | t.RecordExpression>,
): boolean {
  const properties = path.get('properties');
  for (let i = 0, len = properties.length; i < len; i++) {
    const property = properties[i];
    if (isPathValid(property, t.isSpreadElement)) {
      if (!isConstant(instance, property.get('argument'))) {
        return false;
      }
    }
    if (isPathValid(property, t.isObjectProperty)) {
      if (property.node.computed) {
        const key = property.get('key');
        if (isPathValid(key, t.isExpression) && !isConstant(instance, key)) {
          return false;
        }
      }
      const value = property.get('value');
      if (isPathValid(value, t.isExpression) && !isConstant(instance, value)) {
        return false;
      }
    }
  }
  return true;
}

export default function isConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.Expression>,
): boolean {
  if (isPathValid(path, isNestedExpression)) {
    return isConstant(instance, path.get('expression'));
  }
  if (isPathValid(path, t.isLiteral)) {
    if (isPathValid(path, t.isTemplateLiteral)) {
      return isTemplateLiteralConstant(instance, path);
    }
    return true;
  }
  if (isPathValid(path, t.isIdentifier)) {
    return isIdentifierConstant(instance, path, path.node);
  }
  if (isPathValid(path, t.isMemberExpression) || isPathValid(path, t.isOptionalMemberExpression)) {
    return isMemberExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isConditionalExpression)) {
    return isConditionalExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isBinaryExpression)) {
    return isBinaryExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isLogicalExpression)) {
    return isLogicalExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isUnaryExpression)) {
    return isUnaryExpressionConstant(instance, path);
  }
  if (
    isPathValid(path, t.isCallExpression)
    || isPathValid(path, t.isOptionalCallExpression)
  ) {
    return isCallExpressionConstant(instance, path);
  }
  if (
    isPathValid(path, t.isFunctionExpression)
    || isPathValid(path, t.isArrowFunctionExpression)
  ) {
    return isFunctionExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isAssignmentExpression)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isArrayExpression) || isPathValid(path, t.isTupleExpression)) {
    return isArrayExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isObjectExpression) || isPathValid(path, t.isRecordExpression)) {
    return isObjectExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isNewExpression)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isSequenceExpression)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isTaggedTemplateExpression)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isJSXFragment)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isJSXElement)) {
    // TODO
    return false;
  }
  if (isPathValid(path, t.isImport)) {
    return true;
  }
  if (isPathValid(path, t.isMetaProperty)) {
    return true;
  }
  return false;
}
