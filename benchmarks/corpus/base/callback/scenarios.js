import { phases } from '../../shared/scenarios.js';

export default phases(
  'Callback',
  { id: 1, label: 'L', other: 'o' },
  {
    one_other: { id: 1, label: 'L', other: 'p' },
    one_id: { id: 2, label: 'L', other: 'o' },
  },
);
