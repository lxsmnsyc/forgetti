import { armGate } from '../../shared/gate.js';

const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
const changed = [{ id: 1 }, { id: 5 }, { id: 3 }];

export default [
  {
    name: 'update_throws',
    component: 'ThrowRow',
    props: () => ({ gate: armGate(0), items }),
    steps: [
      { name: 'arm', props: () => ({ gate: armGate(1), items: changed }) },
      { name: 'same' },
      { name: 'grow', props: () => ({ gate: armGate(0), items: [...changed, { id: 4 }] }) },
    ],
  },
  {
    name: 'mount_throws',
    component: 'ThrowRow',
    props: () => ({ gate: armGate(1), items }),
    steps: [
      { name: 'same' },
      { name: 'grow', props: () => ({ gate: armGate(0), items: [...items, { id: 4 }] }) },
    ],
  },
];
