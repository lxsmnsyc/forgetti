import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
function costly(k, v) {
  bump(k);
  return v * 2;
}
export function EarlyReturn(t0) {
  const $ = _c(10);
  const {
    loading,
    a,
    b
  } = t0;
  let t1;
  if ($[0] !== a) {
    t1 = costly("head", a);
    $[0] = a;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const head = t1;
  if (loading) {
    let t2;
    if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = <p>loading</p>;
      $[2] = t2;
    } else {
      t2 = $[2];
    }
    return t2;
  }
  let t2;
  if ($[3] !== b) {
    t2 = costly("body", b);
    $[3] = b;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const body = t2;
  let t3;
  if ($[5] !== head) {
    t3 = <Child v={head} />;
    $[5] = head;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  let t4;
  if ($[7] !== body || $[8] !== t3) {
    t4 = <div>{t3}{body}</div>;
    $[7] = body;
    $[8] = t3;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  return t4;
}