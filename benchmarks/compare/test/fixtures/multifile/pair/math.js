import { bump } from '../shared/counter.js';

export function double(n) {
  bump('double');
  return n * 2;
}
