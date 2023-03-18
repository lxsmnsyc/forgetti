import * as babel from '@babel/core';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import { ImportRegistration } from './presets';
import { StateContext } from './types';

export default function getImportIdentifier(
  ctx: StateContext,
  path: babel.NodePath,
  definition: ImportRegistration,
) {
  const target = `${definition.source}[${definition.name}]`;
  const current = ctx.hooks.get(target);
  if (current) {
    return current;
  }
  const newID = (definition.kind === 'named')
    ? addNamed(path, definition.name, definition.source)
    : addDefault(path, definition.source);
  ctx.hooks.set(target, newID);
  return newID;
}
