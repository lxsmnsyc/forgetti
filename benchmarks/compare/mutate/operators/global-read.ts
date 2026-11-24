import { GLOBAL_READ } from '../helpers.ts';
import type { MutantSpec, Operator } from '../types.ts';

// Renders a global that changes on every read. `member` reads it from `globalThis`,
// `free` reads it as an undeclared name, which a compiler may take for a constant.
export const globalRead: Operator = {
  name: 'global-read',
  hazard: 'a changing global read in render',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.probe === null) {
        continue;
      }
      mutants.push(
        { variant: 'member', site: component.name, edits: component.probe.render(GLOBAL_READ) },
        { variant: 'free', site: component.name, edits: component.probe.render('__mutG') },
      );
    }
    return mutants;
  },
};
