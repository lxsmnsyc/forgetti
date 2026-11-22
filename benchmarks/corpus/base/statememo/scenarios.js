import { phases } from '../../shared/scenarios.js';

const L1 = [1, 2, 3];

export default phases(
  'StateMemo',
  { list: L1, tag: 'a' },
  {
    one_tag: { list: L1, tag: 'b' },
    new_list_same_content: { list: [1, 2, 3], tag: 'a' },
  },
  { state: true },
);
