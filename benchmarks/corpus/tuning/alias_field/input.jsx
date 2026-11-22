import { bump } from '../../shared/counter.js';
export function AliasField({ a, b, tag }) {
  const items = [a];
  const box = { items, tag };
  box.items.push(b);
  bump('build');
  return <p>{box.tag}:{items.join(',')}</p>;
}
