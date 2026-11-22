import { phases } from '../../shared/scenarios.js';

const list = [1, 2, 3];

export default phases(
  'AliasClosure',
  { list, tag: 't' },
  {
    new_list: { list: [1, 2, 3], tag: 't' },
    one_item: { list: [1, 2, 4], tag: 't' },
    one_tag: { list, tag: 'u' },
  },
);
