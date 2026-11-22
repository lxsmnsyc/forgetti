import { phases } from '../../shared/scenarios.js';

const items = (...ids) => ids.map((id) => ({ id, name: `n${id}` }));
const I1 = items(1, 2, 3);

export default phases(
  'MapList',
  { items: I1, title: 't' },
  {
    one_title: { items: I1, title: 'u' },
    deep_item: { items: [I1[0], { id: 2, name: 'changed' }, I1[2]], title: 't' },
    append: { items: [...I1, ...items(4)], title: 't' },
  },
);
