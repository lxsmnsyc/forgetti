/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-use-before-define */
import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isNestedExpression, isPathValid } from './checks';
import type OptimizerScope from './optimizer-scope';
import getForeignBindings, { isForeignBinding } from './get-foreign-bindings';
import type { ComponentNode, StateContext } from './types';
import { getHookCallType } from './get-hook-call-type';

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
  const hookType = getHookCallType(instance.ctx, path);
  if (hookType === 'none') {
    const callee = path.get('callee');
    if (
      isPathValid(callee, t.isExpression)
      && !isConstant(instance, callee)
    ) {
      return false;
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
  return false;
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
    if (isPathValid(property, t.isObjectMethod)) {
      // TODO
    }
  }
  return true;
}

function isNewExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.NewExpression>,
): boolean {
  const callee = path.get('callee');
  if (isPathValid(callee, t.isExpression) && isConstant(instance, callee)) {
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
  return false;
}

function isSequenceExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.SequenceExpression>,
): boolean {
  const exprs = path.get('expressions');
  for (let i = 0, len = exprs.length; i < len; i++) {
    if (!isConstant(instance, exprs[i])) {
      return false;
    }
  }
  return true;
}

function isTaggedTemplateExpressionConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.TaggedTemplateExpression>,
): boolean {
  return isConstant(instance, path.get('tag'))
    && isConstant(instance, path.get('quasi'));
}

function isJSXChildrenConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXFragment | t.JSXElement>,
): boolean {
  const children = path.get('children');
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];
    if (isPathValid(child, t.isJSXElement) && !isJSXElementConstant(instance, child)) {
      return false;
    }
    if (isPathValid(child, t.isJSXFragment) && !isJSXChildrenConstant(instance, child)) {
      return false;
    }
    if (isPathValid(child, t.isJSXSpreadChild) && !isConstant(instance, child.get('expression'))) {
      return false;
    }
    if (isPathValid(child, t.isJSXExpressionContainer)) {
      const expr = child.get('expression');
      if (isPathValid(expr, t.isExpression) && !isConstant(instance, expr)) {
        return false;
      }
    }
  }
  return true;
}

function isJSXNameConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName>,
): boolean {
  if (isPathValid(path, t.isJSXNamespacedName)) {
    return true;
  }
  if (isPathValid(path, t.isJSXMemberExpression)) {
    return isJSXNameConstant(instance, path.get('object'));
  }
  if (isPathValid(path, t.isJSXIdentifier)) {
    if (/^[A-Z]/.test(path.node.name)) {
      return isForeignBinding(instance.path, path, path.node.name);
    }
  }
  return true;
}

function isJSXOpeningElementConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXOpeningElement>,
): boolean {
  if (isJSXNameConstant(instance, path.get('name'))) {
    const attrs = path.get('attributes');
    for (let i = 0, len = attrs.length; i < len; i++) {
      const attr = attrs[i];
      if (isPathValid(attr, t.isJSXAttribute)) {
        const value = attr.get('value');
        if (isPathValid(value, t.isJSXElement) && !isJSXElementConstant(instance, value)) {
          return false;
        }
        if (isPathValid(value, t.isJSXFragment) && !isJSXChildrenConstant(instance, value)) {
          return false;
        }
        if (isPathValid(value, t.isJSXExpressionContainer)) {
          const expr = value.get('expression');
          if (isPathValid(expr, t.isExpression) && !isConstant(instance, expr)) {
            return false;
          }
        }
      }
      if (isPathValid(attr, t.isJSXSpreadAttribute) && !isConstant(instance, attr.get('argument'))) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isJSXElementConstant(
  instance: OptimizerInstance,
  path: babel.NodePath<t.JSXElement>,
): boolean {
  return isJSXOpeningElementConstant(instance, path.get('openingElement'))
    && isJSXChildrenConstant(instance, path);
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
  if (isPathValid(path, t.isArrayExpression) || isPathValid(path, t.isTupleExpression)) {
    return isArrayExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isObjectExpression) || isPathValid(path, t.isRecordExpression)) {
    return isObjectExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isNewExpression)) {
    return isNewExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isSequenceExpression)) {
    return isSequenceExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isTaggedTemplateExpression)) {
    return isTaggedTemplateExpressionConstant(instance, path);
  }
  if (isPathValid(path, t.isJSXFragment)) {
    return isJSXChildrenConstant(instance, path);
  }
  if (isPathValid(path, t.isJSXElement)) {
    return isJSXElementConstant(instance, path);
  }
  if (isPathValid(path, t.isImport)) {
    return true;
  }
  if (isPathValid(path, t.isMetaProperty)) {
    return true;
  }
  return false;
}
