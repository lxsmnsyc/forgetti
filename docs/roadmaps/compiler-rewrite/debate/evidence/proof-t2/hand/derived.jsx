import { useCache } from './rt.js';
import { bump } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
export function Derived({ a, b }) {
  const $ = useCache(7);
  if (!Object.is($[0], a)) {
    $[0] = a;
    $[1] = costly("x", a);
  }
  const x = $[1];
  if (!Object.is($[2], b)) {
    $[2] = b;
    $[3] = costly("y", b);
  }
  const y = $[3];
  if (!Object.is($[4], x) || !Object.is($[5], y)) {
    $[4] = x;
    $[5] = y;
    $[6] = <div>{x}-{y}-{x + 1}</div>;
  }
  return $[6];
}
