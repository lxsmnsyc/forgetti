import { bump } from '../../shared/counter.js';
function costly(k, v) { bump(k); return v * 2; }
export function Derived({ a, b }) {
  const x = costly('x', a);
  const y = costly('y', b);
  const z = x + 1;
  return <div>{x}-{y}-{z}</div>;
}
