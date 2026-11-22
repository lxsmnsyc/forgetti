import { phases } from '../../shared/scenarios.js';

export default phases(
  'AliasBranch',
  { a: 1, b: 2, flag: true },
  {
    flag_off: { a: 1, b: 2, flag: false },
    one_a: { a: 3, b: 2, flag: true },
    one_b: { a: 1, b: 4, flag: true },
  },
);
