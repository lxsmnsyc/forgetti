import { phases } from '../../shared/scenarios.js';

const list = [1, 2, 3];

export default phases(
  'AliasSpread',
  { list, extra: 9 },
  {
    new_list: { list: [1, 2, 3], extra: 9 },
    one_extra: { list, extra: 8 },
  },
);
