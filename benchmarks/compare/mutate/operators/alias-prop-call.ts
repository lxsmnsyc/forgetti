import { getPropReads } from '../ast.ts';
import { ALIAS_HELPER, KEY_HELPER, readMark } from '../helpers.ts';
import type { MutantSpec, Operator } from '../types.ts';

// Passes a prop to a same-module function that changes it, then renders what changed.
// A compiler that keys the read on the prop's identity shows a stale count.
export const aliasPropCall: Operator = {
  name: 'alias-prop-call',
  hazard: 'a prop passed to a call that changes it, then read in render',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.probe === null) {
        continue;
      }
      for (const read of getPropReads(component)) {
        mutants.push({
          variant: 'call',
          site: `${component.name}:${read}`,
          edits: [
            ...component.prepend(`__mutAlias(${read});`),
            ...component.probe.render(readMark(read)),
          ],
          helpers: [KEY_HELPER, ALIAS_HELPER],
          // Every candidate is a prop, so every mutant changes props.
          propsMutation: true,
        });
      }
    }
    return mutants;
  },
};
