import { phases } from '../../shared/scenarios.js';

export default phases(
  'HookUser',
  { a: 1, b: 2 },
  {
    one_b: { a: 1, b: 3 },
    one_a: { a: 4, b: 2 },
  },
);
