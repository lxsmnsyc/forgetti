import { phases } from '../../shared/scenarios.js';

export default phases(
  'Ternary',
  { ok: true, a: 1, b: 2 },
  {
    inactive_b: { ok: true, a: 1, b: 3 },
    active_a: { ok: true, a: 7, b: 2 },
  },
);
