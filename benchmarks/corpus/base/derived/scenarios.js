import { phases } from '../../shared/scenarios.js';

export default phases(
  'Derived',
  { a: 1, b: 2 },
  {
    one_b: { a: 1, b: 3 },
    one_a: { a: 5, b: 2 },
  },
);
