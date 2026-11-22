import { phases } from '../../shared/scenarios.js';

const list = [1, 2, 3];

export default phases(
  'Strict',
  { list, tag: 't' },
  {
    new_list: { list: [1, 2, 3], tag: 't' },
    one_tag: { list, tag: 'u' },
  },
  { state: true },
);
