import { phases } from '../../shared/scenarios.js';

function pick(a, b) {
  return a + b;
}

export default phases(
  'AliasChild',
  { a: 1, b: 2, pick },
  {
    one_a: { a: 3, b: 2, pick },
    one_b: { a: 1, b: 4, pick },
    new_pick: { a: 1, b: 2, pick: (a, b) => pick(a, b) },
  },
);
