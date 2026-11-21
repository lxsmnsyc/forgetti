import { c as _c } from "react/compiler-runtime";
import { bump } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
export function Derived(t0) {
  const $ = _c(6);
  const {
    a,
    b
  } = t0;
  const x = costly("x", a);
  let t1;
  if ($[0] !== b) {
    t1 = costly("y", b);
    $[0] = b;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const y = t1;
  const z = x + 1;
  let t2;
  if ($[2] !== x || $[3] !== y || $[4] !== z) {
    t2 = <div>{x}-{y}-{z}</div>;
    $[2] = x;
    $[3] = y;
    $[4] = z;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  return t2;
}