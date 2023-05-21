import type * as babel from '@babel/core';
import type * as t from '@babel/types';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import type { ImportDefinition } from './presets';
import type { StateContext } from './types';

export default function getImportIdentifier(
  ctx: StateContext,
  path: babel.NodePath,
  definition: ImportDefinition,
): t.Identifier {
  const name = definition.kind === 'default' ? 'default' : definition.name;
  const target = `${definition.source}[${name}]`;
  const current = ctx.imports.get(target);
  if (current) {
    return current;
  }
  const newID = (definition.kind === 'named')
    ? addNamed(path, definition.name, definition.source)
    : addDefault(path, definition.source);
  ctx.imports.set(target, newID);
  return newID;
}
