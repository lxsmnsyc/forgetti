import { armGate } from '../../shared/gate.js';

export default [
  {
    name: 'update_throws',
    component: 'ThrowCall',
    props: () => ({ gate: armGate(0), a: 1, tag: 't' }),
    steps: [
      { name: 'arm', props: () => ({ gate: armGate(1), a: 2, tag: 't' }) },
      { name: 'same' },
      { name: 'one_tag', props: () => ({ gate: armGate(0), a: 2, tag: 'u' }) },
    ],
  },
  {
    name: 'mount_throws',
    component: 'ThrowCall',
    props: () => ({ gate: armGate(1), a: 1, tag: 't' }),
    steps: [
      { name: 'same' },
      { name: 'one_a', props: () => ({ gate: armGate(0), a: 2, tag: 't' }) },
    ],
  },
];
