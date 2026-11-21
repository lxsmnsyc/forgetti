import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
export function Switch(t0) {
  const $ = _c(7);
  const {
    kind,
    a,
    b
  } = t0;
  let el;
  bb0: switch (kind) {
    case "a":
      {
        let t1;
        if ($[0] !== a) {
          t1 = <Child v={a} />;
          $[0] = a;
          $[1] = t1;
        } else {
          t1 = $[1];
        }
        el = t1;
        break bb0;
      }
    case "b":
      {
        let t1;
        if ($[2] !== b) {
          t1 = <Child v={b} />;
          $[2] = b;
          $[3] = t1;
        } else {
          t1 = $[3];
        }
        el = t1;
        break bb0;
      }
    default:
      {
        let t1;
        if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <em>none</em>;
          $[4] = t1;
        } else {
          t1 = $[4];
        }
        el = t1;
      }
  }
  let t1;
  if ($[5] !== el) {
    t1 = <div>{el}</div>;
    $[5] = el;
    $[6] = t1;
  } else {
    t1 = $[6];
  }
  return t1;
}