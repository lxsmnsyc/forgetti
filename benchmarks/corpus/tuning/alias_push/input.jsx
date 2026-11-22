import { bump } from '../../shared/counter.js';
export function AliasPush({ a, b, tag }) {
  const arr = [a];
  const x = arr;
  x.push(b);
  bump('build');
  return <p>{tag}:{arr.join(',')}</p>;
}
