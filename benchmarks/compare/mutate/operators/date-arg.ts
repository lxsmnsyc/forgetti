import { getLine, replace, walk } from '../ast.ts';
import type { MutantSpec, Node, Operator } from '../types.ts';

const CLOCK_DATE = 'new Date(Date.now())';

// `new Date(arg)` reads no clock, but `new Date(Date.now())` does. The runner moves the
// clock one day per `Date.now()` call, so the date changes on every render.
// - arg: an existing `new Date(x)` gets `Date.now()` as its argument.
// - probe: a component renders `new Date(Date.now())` as a day string.
// A planner that takes every `new Date(...)` with an argument as stable keeps the old day.
export const dateArg: Operator = {
  name: 'date-arg',
  hazard: 'new Date(arg) whose argument reads the clock',
  generate(file) {
    const mutants: MutantSpec[] = [];
    walk(file.program, (node) => {
      if (node.type !== 'NewExpression') {
        return;
      }
      const callee = node.callee as Node;
      const args = node.arguments as Node[];
      const first = args[0];
      const last = args.at(-1);
      if (
        callee.type !== 'Identifier' ||
        callee.name !== 'Date' ||
        first === undefined ||
        last === undefined
      ) {
        return;
      }
      mutants.push({
        variant: 'arg',
        site: `${getLine(file.code, node.start)}`,
        edits: [replace(first.start, last.end, 'Date.now()')],
      });
    });

    for (const component of file.components) {
      if (component.probe !== null) {
        mutants.push({
          variant: 'probe',
          site: component.name,
          edits: component.probe.render(`${CLOCK_DATE}.toISOString().slice(0, 10)`),
        });
      }
    }
    return mutants;
  },
};
