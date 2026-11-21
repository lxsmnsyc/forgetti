import { c as _c } from "react/compiler-runtime";
import { bump } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
function useThing(a, b) {
  const x = costly('x', a);
  const y = costly('y', b);
  return {
    x,
    y
  };
}
export function HookUser(t0) {
  const $ = _c(3);
  const {
    a,
    b
  } = t0;
  const {
    x,
    y
  } = useThing(a, b);
  let t1;
  if ($[0] !== x || $[1] !== y) {
    t1 = <b>{x}:{y}</b>;
    $[0] = x;
    $[1] = y;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  return t1;
}