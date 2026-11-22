import { phases } from '../../shared/scenarios.js';

const L1 = [1, 2, 3];

const scenarios = phases(
  'ForLoop',
  { items: L1, title: 't' },
  {
    one_title: { items: L1, title: 'u' },
    new_array_same: { items: [1, 2, 3], title: 't' },
    deep_item: { items: [1, 9, 3], title: 't' },
  },
);

// The list grows, then shrinks to one new item.
scenarios.push({
  name: 'grow_shrink',
  component: 'ForLoop',
  props: { items: [1, 2, 3], title: 't' },
  steps: [
    { name: 'grow', props: { items: [1, 2, 3, 4], title: 't' } },
    { name: 'shrink', props: { items: [5], title: 't' } },
  ],
});

export default scenarios;
