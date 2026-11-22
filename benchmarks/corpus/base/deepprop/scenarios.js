import { phases } from '../../shared/scenarios.js';

const O1 = { a: { b: 1 } };

export default phases(
  'DeepProp',
  { obj: O1, other: 'o' },
  {
    one_other: { obj: O1, other: 'p' },
    deep_leaf: { obj: { a: { b: 2 } }, other: 'o' },
    deep_newrefs_same_leaf: { obj: { a: { b: 1 } }, other: 'o' },
  },
);
