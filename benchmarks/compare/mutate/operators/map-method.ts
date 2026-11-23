import { describeFunction, findMethodCalls, getLine, isFunction } from '../ast.ts';
import { GLOBAL_READ } from '../helpers.ts';
import type { MutantSpec, Node, Operator } from '../types.ts';

const SEQUENCE = `const __mutSeq = { read() { return ${GLOBAL_READ}; } };`;

// Calls a method on a module object inside a `.map` callback and renders the result
// per item. The method reads the changing global, which the call hides. A compiler
// that caches the mapped list keeps the old value.
export const mapMethod: Operator = {
  name: 'map-method',
  hazard: 'a method call inside .map',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      for (const call of findMethodCalls(component.body, new Set(['map']))) {
        const callback = (call.arguments as Node[])[0] as Node;
        if (!isFunction(callback)) {
          continue;
        }
        const probe = describeFunction(file.code, callback).probe;
        if (probe === null) {
          continue;
        }
        mutants.push({
          variant: 'module-object',
          site: `${component.name}:${getLine(file.code, call.start)}`,
          edits: probe.render('__mutSeq.read()'),
          helpers: [SEQUENCE],
        });
      }
    }
    return mutants;
  },
};
