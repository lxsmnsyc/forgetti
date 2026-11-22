import { phases } from '../../shared/scenarios.js';

export default phases(
  'TryCatch',
  { a: 1, label: 'x' },
  {
    one_label: { a: 1, label: 'y' },
    one_a: { a: 3, label: 'x' },
    throw: { a: -1, label: 'x' },
  },
);
