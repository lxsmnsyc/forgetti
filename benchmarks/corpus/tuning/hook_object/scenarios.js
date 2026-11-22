import { phases } from '../../shared/scenarios.js';

const list = [1, 2, 3];

export default phases(
  'HookObject',
  { list, scale: 2, tag: 't' },
  {
    new_list: { list: [1, 2, 3], scale: 2, tag: 't' },
    one_scale: { list, scale: 3, tag: 't' },
    one_tag: { list, scale: 2, tag: 'u' },
  },
  { state: true },
);
