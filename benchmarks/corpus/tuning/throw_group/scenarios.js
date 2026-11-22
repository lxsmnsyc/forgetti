import { armGate } from '../../shared/gate.js';

const list = [1, 2, 3];

export default [
  {
    name: 'update_throws',
    component: 'ThrowGroup',
    props: () => ({ gate: armGate(0), list, tag: 't' }),
    steps: [
      { name: 'arm', props: () => ({ gate: armGate(1), list: [1, 2, 4], tag: 't' }) },
      { name: 'same' },
      { name: 'one_tag', props: () => ({ gate: armGate(0), list: [1, 2, 4], tag: 'u' }) },
    ],
  },
  {
    name: 'mount_throws',
    component: 'ThrowGroup',
    props: () => ({ gate: armGate(1), list, tag: 't' }),
    steps: [
      { name: 'same' },
      { name: 'one_tag', props: () => ({ gate: armGate(0), list, tag: 'u' }) },
    ],
  },
];
