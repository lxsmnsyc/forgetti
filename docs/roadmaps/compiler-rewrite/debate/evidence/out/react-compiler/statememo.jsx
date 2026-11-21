import { c as _c } from "react/compiler-runtime";
import { useState, useMemo, useEffect } from 'react';
import { bump } from './counter.js';
function sumOf(list) {
  bump('total');
  return list.reduce((s, v) => s + v, 0);
}
export function StateMemo(t0) {
  const $ = _c(8);
  const {
    list,
    tag
  } = t0;
  const [n, setN] = useState(0);
  let t1;
  if ($[0] !== list) {
    t1 = sumOf(list);
    $[0] = list;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const total = t1;
  let t2;
  let t3;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = () => {
      globalThis.__setN = setN;
    };
    t3 = [];
    $[2] = t2;
    $[3] = t3;
  } else {
    t2 = $[2];
    t3 = $[3];
  }
  useEffect(t2, t3);
  let t4;
  if ($[4] !== n || $[5] !== tag || $[6] !== total) {
    t4 = <div>{tag}:{total}:{n}</div>;
    $[4] = n;
    $[5] = tag;
    $[6] = total;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  return t4;
}