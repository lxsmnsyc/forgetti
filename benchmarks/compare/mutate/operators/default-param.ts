import { insert } from '../ast.ts';
import { KEY_HELPER, readMark, writeMark } from '../helpers.ts';
import type { MutantSpec, Node, Operator } from '../types.ts';

const LITERALS = new Set(['ObjectExpression', 'ArrayExpression']);

/**
 * Destructured props with a fresh literal default (`{ x = {} }`) in the first parameter.
 * A whole-parameter default (`(x = {})`) is skipped: the caller's raw value cannot be
 * read beside it without changing the parameter list's shape.
 */
function findFreshDefaults(params: Node[]): { name: string; property: Node }[] {
  const found: { name: string; property: Node }[] = [];
  const first = params[0];
  if (first?.type !== 'ObjectPattern') {
    return found;
  }
  for (const property of first.properties as Node[]) {
    if (property.type !== 'ObjectProperty') {
      continue;
    }
    const pattern = property.value as Node;
    if (
      pattern.type === 'AssignmentPattern' &&
      (pattern.left as Node).type === 'Identifier' &&
      LITERALS.has((pattern.right as Node).type)
    ) {
      found.push({ name: (pattern.left as Node).name as string, property });
    }
  }
  return found;
}

// Changes a fresh literal default in render and renders the change. Uncompiled, the
// default is new on every render, so the count stays 1. A planner that keeps one
// default object while the parameter is `undefined` shows the count grow.
// - existing-default: a default the component already has, changed only when the
//   default is used (the caller passed nothing). This is the census D hazard.
// - existing-passed: the same prop, changed only when the caller passed a value. That
//   changes props, which is out of contract (allowed as props mutation).
//   The caller's raw value is read by destructuring the same key a second time
//   (`{ x = {}, x: __mutRaw }`), which keeps the default parameter as it is.
// - added: a new destructured prop `__mutOpt = {}` that no scenario passes.
export const defaultParam: Operator = {
  name: 'default-param',
  hazard: 'a fresh default parameter changed in render',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.probe === null) {
        continue;
      }
      for (const { name, property } of findFreshDefaults(component.params)) {
        const keyNode = property.key as Node;
        const key = property.computed === true ? `[${file.slice(keyNode)}]` : file.slice(keyNode);
        const raw = insert(property.end, `, ${key}: __mutRaw`);
        const probe = component.probe.render(readMark(name));
        mutants.push(
          {
            variant: 'existing-default',
            site: `${component.name}:${name}`,
            edits: [
              raw,
              ...component.prepend(`if (__mutRaw === undefined) { ${writeMark(name)} }`),
              ...probe,
            ],
            helpers: [KEY_HELPER],
          },
          {
            variant: 'existing-passed',
            site: `${component.name}:${name}`,
            edits: [
              raw,
              ...component.prepend(`if (__mutRaw !== undefined) { ${writeMark(name)} }`),
              ...probe,
            ],
            helpers: [KEY_HELPER],
            propsMutation: true,
          },
        );
      }
      const first = component.params[0];
      if (first?.type === 'ObjectPattern') {
        mutants.push({
          variant: 'added',
          site: component.name,
          edits: [
            insert(first.start + 1, ' __mutOpt = {}, '),
            ...component.prepend(writeMark('__mutOpt')),
            ...component.probe.render(readMark('__mutOpt')),
          ],
          helpers: [KEY_HELPER],
        });
      }
    }
    return mutants;
  },
};
