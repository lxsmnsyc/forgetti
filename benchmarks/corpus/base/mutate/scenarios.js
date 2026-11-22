import { phases } from '../../shared/scenarios.js';

export default phases(
  'Mutate',
  { a: 1, b: 2, c: 'x' },
  {
    one_c: { a: 1, b: 2, c: 'y' },
    one_a: { a: 5, b: 2, c: 'x' },
  },
);
