import {
  describeFunction,
  findMethodCalls,
  getLine,
  getPropRoots,
  getRootName,
  insert,
  isFunction,
} from '../ast.ts';
import { KEY_HELPER, readMark, writeMark } from '../helpers.ts';
import type { MutantSpec, Node, Operator } from '../types.ts';

// A `map`, `filter` or `find` callback that changes its element.
// - map: the callback marks its element and renders the mark, so a cached list shows old marks.
// - filter, find: the callback marks its element and also accepts an element marked more than
//   once, so from the second render on the result grows. A cached result does not.
export const callbackMutate: Operator = {
  name: 'callback-mutate',
  hazard: 'a map, filter or find callback that changes its element',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      const propRoots = getPropRoots(component);
      for (const call of findMethodCalls(component.body, new Set(['map', 'filter', 'find']))) {
        const callee = call.callee as Node;
        const method = (callee.property as Node).name as string;
        const callback = (call.arguments as Node[])[0] as Node;
        const site = `${component.name}:${getLine(file.code, call.start)}`;
        // The elements belong to props when the list is read through a prop name.
        const root = getRootName(callee.object as Node);
        const propsMutation = root !== null && propRoots.has(root);

        if (method === 'map') {
          // Only an inline callback whose element is a plain parameter and that returns JSX.
          if (!isFunction(callback)) {
            continue;
          }
          const info = describeFunction(file.code, callback);
          const element = info.params[0];
          if (element?.type !== 'Identifier' || info.probe === null) {
            continue;
          }
          const name = element.name as string;
          mutants.push({
            variant: 'map',
            site,
            edits: [...info.prepend(writeMark(name)), ...info.probe.render(readMark(name))],
            helpers: [KEY_HELPER],
            propsMutation,
          });
          continue;
        }

        // Any callback, inline or by name, is wrapped.
        const marked = '__a !== null && typeof __a === "object" && __a[__mutKey] > 1';
        mutants.push({
          variant: method,
          site,
          edits: [
            insert(callback.start, `(__a, __i, __l) => { ${writeMark('__a')} return (`, 0),
            insert(callback.end, `)(__a, __i, __l) || (${marked}); }`, 10),
          ],
          helpers: [KEY_HELPER],
          propsMutation,
        });
      }
    }
    return mutants;
  },
};
