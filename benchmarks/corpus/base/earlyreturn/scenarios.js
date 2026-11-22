import { phases } from '../../shared/scenarios.js';

export default phases(
  'EarlyReturn',
  { loading: false, a: 1, b: 2 },
  {
    one_b: { loading: false, a: 1, b: 3 },
    one_loading: { loading: true, a: 1, b: 2 },
  },
);
