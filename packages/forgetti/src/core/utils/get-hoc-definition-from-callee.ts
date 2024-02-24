import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { ImportDefinition } from '../presets';
import type { StateContext } from '../types';
import unwrapNode from './unwrap-node';

function getHOCDefinitionFromPropName(
  definitions: ImportDefinition[],
  propName: string,
): ImportDefinition | undefined {
  for (let i = 0, len = definitions.length; i < len; i++) {
    const def = definitions[i];
    if (def.kind === 'default' && propName === 'default') {
      return def;
    }
    if (def.kind === 'named' && propName === def.name) {
      return def;
    }
  }
  return undefined;
}

export function getHOCDefinitionFromCallee(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
): ImportDefinition | undefined {
  const callee = path.node.callee;
  const id = unwrapNode(callee, t.isIdentifier);
  if (id) {
    const binding = path.scope.getBindingIdentifier(id.name);
    if (binding) {
      return ctx.registrations.hooks.identifiers.get(binding);
    }
    return undefined;
  }
  const memberExpr = unwrapNode(callee, t.isMemberExpression);
  if (
    memberExpr &&
    !memberExpr.computed &&
    t.isIdentifier(memberExpr.property)
  ) {
    const object = unwrapNode(memberExpr.object, t.isIdentifier);
    if (object) {
      const binding = path.scope.getBindingIdentifier(object.name);
      if (binding) {
        const definitions = ctx.registrations.hocs.namespaces.get(binding);
        if (definitions) {
          return getHOCDefinitionFromPropName(
            definitions,
            memberExpr.property.name,
          );
        }
      }
    }
  }
  return undefined;
}
