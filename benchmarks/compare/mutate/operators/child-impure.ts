import { getPropReads } from '../ast.ts';
import { GLOBAL_READ } from '../helpers.ts';
import type { MutantSpec, Operator } from '../types.ts';

// What the child's render reads. Each changes between renders with the same props.
const READS: { variant: string; tag: string; setup: string; value: string; react: string[] }[] = [
  { variant: 'now', tag: 'Now', setup: '', value: 'Date.now()', react: [] },
  { variant: 'global', tag: 'Global', setup: '', value: GLOBAL_READ, react: [] },
  {
    variant: 'ref',
    tag: 'Ref',
    // An effect copies the global into the ref after each commit, so the render reads
    // the value of the step before.
    setup: `const r = useRef(0); useEffect(() => { r.current = ${GLOBAL_READ}; });`,
    value: 'r.current',
    react: ['useRef', 'useEffect'],
  },
];

// Adds a same-module child whose render reads `Date.now()`, a changing global or
// `ref.current`, and renders it as a tag in a component, with and without `memo`. A
// compiler that caches the child element skips the child's render and its new value.
// The child gets the component's first prop, so `memo` re-renders only when it changes.
export const childImpure: Operator = {
  name: 'child-impure',
  hazard:
    'a same-module child used as a tag whose render reads Date.now(), a global or ref.current',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      if (component.probe === null) {
        continue;
      }
      const first = getPropReads(component)[0];
      const props = first === undefined ? '' : ` v={${first}}`;
      for (const read of READS) {
        const plain = `MutantChild${read.tag}`;
        const memo = `MutantChild${read.tag}Memo`;
        // The memo child stamps its output with the step it rendered in, like every
        // memo body in a marked mutant (see `generate.ts`). The `ref` variant renders a
        // value written at its last commit, so its value is as old as that commit: a
        // skip `memo` allowed in an earlier step shows in a later render. Its stamp is
        // that commit's step.
        const stamp = read.variant === 'ref' ? 'r.current' : GLOBAL_READ;
        const memoBody = `${read.setup} return <mut-memo data-s={${stamp}}><i>{${read.value}}</i></mut-memo>;`;
        mutants.push(
          {
            variant: read.variant,
            site: component.name,
            edits: component.probe.render(`<${plain}${props} />`, true),
            helpers: [`function ${plain}({ v }) { ${read.setup} return <i>{${read.value}}</i>; }`],
            react: read.react,
          },
          {
            variant: `memo-${read.variant}`,
            memoChild: true,
            site: component.name,
            edits: component.probe.render(`<${memo}${props} />`, true),
            helpers: [`const ${memo} = memo(function ${memo}({ v }) { ${memoBody} });`],
            react: [...read.react, 'memo'],
          },
        );
      }
    }
    return mutants;
  },
};
