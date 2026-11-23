import { getLine, insert, readsName, replace } from '../ast.ts';
import type { ComponentInfo, MutantSpec, Node, Operator, SourceFile } from '../types.ts';

/** The top-level `X.p = value;` statements of a file, with `X` a top-level name. */
function findMemberWrites(
  file: SourceFile,
): { statement: Node; object: string; property: string }[] {
  const writes: { statement: Node; object: string; property: string }[] = [];
  for (const statement of file.program.body as Node[]) {
    if (statement.type !== 'ExpressionStatement') {
      continue;
    }
    const expression = statement.expression as Node;
    if (expression.type !== 'AssignmentExpression' || expression.operator !== '=') {
      continue;
    }
    const left = expression.left as Node;
    if (left.type !== 'MemberExpression' || left.computed === true) {
      continue;
    }
    const object = left.object as Node;
    if (object.type !== 'Identifier' || !file.topLevel.has(object.name as string)) {
      continue;
    }
    writes.push({
      statement,
      object: object.name as string,
      property: (left.property as Node).name as string,
    });
  }
  return writes;
}

/** The component that renders the probe: the first other one that reads `name`, else the first exported one. */
function findReader(file: SourceFile, name: string): ComponentInfo | null {
  for (const component of file.components) {
    if (component.name !== name && component.probe !== null && readsName(component.body, name)) {
      return component;
    }
  }
  for (const component of file.components) {
    if (component.name !== name && component.probe !== null && component.exported) {
      return component;
    }
  }
  return null;
}

// Moves a top-level `X.displayName = ...` or `X.Item = ...` write and renders `typeof X.p`
// in a component that reads `X`.
// - cond: the write moves into X's render function inside `if (X.p === undefined)`.
//   (A top-level `if` runs once at load, so its probe could never change.)
// - fn: the write moves into the body of X's own render function, so the reader sees
//   `undefined` before X first renders and the value after.
// - handler: the write moves into a ref callback on the reader's host element, which
//   runs at commit, so the reader sees the value only from the second render.
// A compiler that treats X's members as fixed keeps the first `typeof`.
export const identityWrite: Operator = {
  name: 'identity-write',
  hazard:
    'a top-level displayName or X.Item write moved into a conditional, a function body or a handler',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const write of findMemberWrites(file)) {
      const reader = findReader(file, write.object);
      if (reader === null || reader.probe === null) {
        continue;
      }
      const text = file.slice(write.statement);
      const site = `${write.object}.${write.property}:${getLine(file.code, write.statement.start)}`;
      const probe = reader.probe.render(`typeof ${write.object}.${write.property}`);
      const remove = replace(write.statement.start, write.statement.end, '');

      // The write goes into X's render function when X is a component of this file.
      let target: ComponentInfo | null = null;
      for (const component of file.components) {
        if (component.name === write.object) {
          target = component;
        }
      }
      if (target !== null) {
        const member = `${write.object}.${write.property}`;
        mutants.push(
          {
            variant: 'cond',
            site,
            component: reader.name,
            edits: [
              remove,
              ...target.prepend(`if (${member} === undefined) { ${text} }`),
              ...probe,
            ],
          },
          {
            variant: 'fn',
            site,
            component: reader.name,
            edits: [remove, ...target.prepend(text), ...probe],
          },
        );
      }

      if (reader.probe.attributeAt !== null) {
        mutants.push({
          variant: 'handler',
          component: reader.name,
          site,
          edits: [remove, insert(reader.probe.attributeAt, ` ref={() => { ${text} }}`), ...probe],
        });
      }
    }
    return mutants;
  },
};
