import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
export function Ternary(t0) {
  const $ = _c(4);
  const {
    ok,
    a,
    b
  } = t0;
  let t1;
  if ($[0] !== a || $[1] !== b || $[2] !== ok) {
    t1 = ok ? <div><Child v={a} /></div> : <span><Child v={b} /></span>;
    $[0] = a;
    $[1] = b;
    $[2] = ok;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  return t1;
}