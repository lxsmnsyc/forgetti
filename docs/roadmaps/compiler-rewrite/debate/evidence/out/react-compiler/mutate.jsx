import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
export function Mutate(t0) {
  const $ = _c(8);
  const {
    a,
    b,
    c
  } = t0;
  let arr;
  if ($[0] !== a || $[1] !== b) {
    arr = [a];
    arr.push(b);
    $[0] = a;
    $[1] = b;
    $[2] = arr;
  } else {
    arr = $[2];
  }
  const label = c + "!";
  let t1;
  if ($[3] !== arr) {
    t1 = arr.map(_temp);
    $[3] = arr;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  let t2;
  if ($[5] !== label || $[6] !== t1) {
    t2 = <div>{label}{t1}</div>;
    $[5] = label;
    $[6] = t1;
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  return t2;
}
function _temp(v, i) {
  return <Child key={i} v={v} />;
}