import { bump } from '../../shared/counter.js';
export function AliasUnknown({ a, b, grow }) {
  const arr = [a];
  const n = grow(arr, b);
  bump('build');
  return <p>{n}:{arr.join(',')}</p>;
}
