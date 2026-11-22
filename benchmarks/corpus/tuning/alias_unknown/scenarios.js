import { phases } from '../../shared/scenarios.js';

function grow(target, v) {
  target.push(v);
  return target.length;
}

export default phases(
  'AliasUnknown',
  { a: 1, b: 2, grow },
  {
    one_a: { a: 3, b: 2, grow },
    one_b: { a: 1, b: 4, grow },
    new_grow: { a: 1, b: 2, grow: (target, v) => grow(target, v) },
  },
);
