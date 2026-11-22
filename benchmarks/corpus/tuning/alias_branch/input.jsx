import { bump } from '../../shared/counter.js';
export function AliasBranch({ a, b, flag }) {
  const out = [a];
  if (flag) { out.push(b); }
  bump('build');
  return <p>{out.join(',')}</p>;
}
