import { GLOBAL_READ } from '../helpers.ts';
import type { MutantSpec, Operator } from '../types.ts';

const CALL = 'function MutantCall({ fn }) { return <b>{fn()}</b>; }';
const CALL_MEMO =
  'const MutantCallMemo = memo(function MutantCallMemo({ fn }) { return <b>{fn()}</b>; });';

// Creates a closure over a changing global and passes it to a same-module child that
// calls it in its render. A compiler that caches the closure skips the new value.
export const closureChild: Operator = {
  name: 'closure-child',
  hazard: "a closure called in a child's render",
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.probe === null) {
        continue;
      }
      const closure = `const __mutFn = () => ${GLOBAL_READ};`;
      mutants.push(
        {
          variant: 'plain',
          site: component.name,
          edits: [
            ...component.prepend(closure),
            ...component.probe.render('<MutantCall fn={__mutFn} />', true),
          ],
          helpers: [CALL],
        },
        {
          variant: 'memo',
          site: component.name,
          edits: [
            ...component.prepend(closure),
            ...component.probe.render('<MutantCallMemo fn={__mutFn} />', true),
          ],
          helpers: [CALL_MEMO],
          react: ['memo'],
        },
      );
    }
    return mutants;
  },
};
