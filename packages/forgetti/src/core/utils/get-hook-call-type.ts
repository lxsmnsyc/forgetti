import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isHookName, isPathValid } from './checks';
import type { HookIdentity } from '../presets';
import unwrapNode from './unwrap-node';
import type { StateContext } from '../types';

type HookCallType = HookIdentity | 'custom' | 'none';

function getHookCallTypeFromIdentifier(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  id: t.Identifier,
): HookCallType {
  const binding = path.scope.getBindingIdentifier(id.name);
  if (binding) {
    const registration = ctx.registrations.hooks.identifiers.get(binding);
    if (registration) {
      return registration.type;
    }
  }
  return isHookName(ctx, id) ? 'custom' : 'none';
}

function getHookCallTypeFromNamespace(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  object: t.Identifier,
  property: t.Identifier,
): HookCallType {
  const binding = path.scope.getBindingIdentifier(object.name);
  if (!binding) {
    return 'none';
  }
  const registrations = ctx.registrations.hooks.namespaces.get(binding);
  if (registrations) {
    for (let i = 0, len = registrations.length; i < len; i += 1) {
      const registration = registrations[i];
      if (registration.kind === 'default') {
        if (property.name === 'default') {
          return registration.type;
        }
      } else if (registration.name === property.name) {
        return registration.type;
      }
    }
  }
  return 'none';
}

function getHookCallTypeFromMemberExpression(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
  member: t.MemberExpression,
): HookCallType {
  if (!member.computed && t.isIdentifier(member.property)) {
    const obj = unwrapNode(member.object, t.isIdentifier);
    if (obj) {
      return getHookCallTypeFromNamespace(ctx, path, obj, member.property);
    }
    return isHookName(ctx, member.property) ? 'custom' : 'none';
  }
  return 'none';
}

export function getHookCallType(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression | t.OptionalCallExpression>,
): HookCallType {
  const callee = path.get('callee');
  if (isPathValid(callee, t.isV8IntrinsicIdentifier)) {
    return 'none';
  }
  const trueID = unwrapNode(callee.node, t.isIdentifier);
  if (trueID) {
    return getHookCallTypeFromIdentifier(ctx, path, trueID);
  }
  // Check if callee is potentially a namespace import
  const trueMember = unwrapNode(callee.node, t.isMemberExpression);
  if (trueMember) {
    return getHookCallTypeFromMemberExpression(ctx, path, trueMember);
  }
  return 'none';
}
