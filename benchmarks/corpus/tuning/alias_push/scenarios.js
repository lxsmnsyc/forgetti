import { phases } from '../../shared/scenarios.js';

export default phases(
  'AliasPush',
  { a: 1, b: 2, tag: 't' },
  {
    one_a: { a: 3, b: 2, tag: 't' },
    one_b: { a: 1, b: 4, tag: 't' },
    one_tag: { a: 1, b: 2, tag: 'u' },
  },
);
