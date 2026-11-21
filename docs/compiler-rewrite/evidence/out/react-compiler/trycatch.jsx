import { c as _c } from "react/compiler-runtime";
import { bump } from './counter.js';
function risky(v) {
  bump('risky');
  if (v < 0) throw new Error('neg');
  return v * 2;
}
export function TryCatch(t0) {
  const $ = _c(5);
  const {
    a,
    label
  } = t0;
  let out;
  ;
  try {
    let t2;
    if ($[0] !== a) {
      t2 = risky(a);
      $[0] = a;
      $[1] = t2;
    } else {
      t2 = $[1];
    }
    out = t2;
  } catch (t1) {
    out = "err";
  }
  let t2;
  if ($[2] !== label || $[3] !== out) {
    t2 = <div>{label}:{out}</div>;
    $[2] = label;
    $[3] = out;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  return t2;
}