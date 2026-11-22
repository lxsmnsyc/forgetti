import { armGate, disarmGate } from '../../shared/gate.js';

// The gate stays armed until the reset step, so every attempt throws.
const ARMED = Infinity;

function reset() {
  disarmGate();
  globalThis.__reset();
}

export default [
  {
    name: 'swap',
    component: 'ThrowSwap',
    props: () => ({ gate: armGate(0), a: 1, tag: 't' }),
    steps: [
      { name: 'arm', props: () => ({ gate: armGate(ARMED), a: 2, tag: 't' }) },
      { name: 'reset', act: reset },
      { name: 'one_tag', props: () => ({ gate: armGate(0), a: 2, tag: 'u' }) },
    ],
  },
  {
    name: 'mount_swap',
    component: 'ThrowSwap',
    props: () => ({ gate: armGate(ARMED), a: 1, tag: 't' }),
    steps: [
      { name: 'reset', act: reset },
      { name: 'one_a', props: () => ({ gate: armGate(0), a: 2, tag: 't' }) },
    ],
  },
];
