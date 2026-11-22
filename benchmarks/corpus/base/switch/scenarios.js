import { phases } from '../../shared/scenarios.js';

export default phases(
  'Switch',
  { kind: 'a', a: 1, b: 2 },
  {
    inactive_b: { kind: 'a', a: 1, b: 3 },
    active_a: { kind: 'a', a: 7, b: 2 },
    kind_b: { kind: 'b', a: 1, b: 2 },
  },
);
