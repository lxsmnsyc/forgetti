import { getLine, getPropRoots, getRootName, insert } from '../ast.ts';
import { KEY_HELPER, readMark, writeMark } from '../helpers.ts';
import type { MutantSpec, Node, Operator } from '../types.ts';

const METHODS = new Set(['find', 'filter', 'map']);

/** The method name when `init` is `<receiver>.find|filter|map(...)`, else null. */
function getResultMethod(init: Node): string | null {
  if (init.type !== 'CallExpression' && init.type !== 'OptionalCallExpression') {
    return null;
  }
  const callee = init.callee as Node;
  if (
    (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') ||
    callee.computed === true
  ) {
    return null;
  }
  const name = (callee.property as Node).name as string;
  return METHODS.has(name) ? name : null;
}

// Changes the result of a `find` (or `filter`, `map`) after the call and renders the change.
// `const r = list.find(...)` in the component body is followed by a write to `r`. A compiler
// that keys the read on `r` or caches the call on `list` shows a stale count.
export const resultMutate: Operator = {
  name: 'result-mutate',
  hazard: 'a find result changed after the call',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.body.type !== 'BlockStatement') {
        continue;
      }
      const propRoots = getPropRoots(component);
      for (const statement of component.body.body as Node[]) {
        if (statement.type !== 'VariableDeclaration') {
          continue;
        }
        for (const declarator of statement.declarations as Node[]) {
          const id = declarator.id as Node;
          const init = declarator.init as Node | null;
          if (id.type !== 'Identifier' || init === null) {
            continue;
          }
          const method = getResultMethod(init);
          if (method === null) {
            continue;
          }

          // The probe goes in a return after the declaration, where the name is in scope.
          let probe = null;
          for (const candidate of component.probes) {
            if (candidate.returnStart > statement.end) {
              probe = candidate;
            }
          }
          if (probe === null) {
            continue;
          }
          // `find` returns an element of the list: a props object when the list is read
          // through a prop. `filter` and `map` return a new array, which is the component's own.
          const root = getRootName((init.callee as Node).object as Node);
          const propsMutation = method === 'find' && root !== null && propRoots.has(root);
          const name = id.name as string;
          mutants.push({
            variant: method,
            site: `${component.name}:${getLine(file.code, statement.start)}`,
            edits: [insert(statement.end, ` ${writeMark(name)}`), ...probe.render(readMark(name))],
            helpers: [KEY_HELPER],
            propsMutation,
          });
        }
      }
    }
    return mutants;
  },
};
