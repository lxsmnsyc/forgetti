import { bump } from '../../shared/counter.js';
export function AliasSpread({ list, extra }) {
  const copy = [...list];
  copy.push(extra);
  bump('build');
  return <p>{list.length}:{copy.join(',')}</p>;
}
