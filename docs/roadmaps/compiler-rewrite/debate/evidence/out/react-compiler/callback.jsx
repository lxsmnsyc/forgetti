import { c as _c } from "react/compiler-runtime";
import { bump, Btn } from './counter.js';
export function Callback(t0) {
  const $ = _c(8);
  const {
    id,
    label,
    other
  } = t0;
  let t1;
  if ($[0] !== id) {
    t1 = () => {
      globalThis.__clicked = id;
    };
    $[0] = id;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const onClick = t1;
  let t2;
  if ($[2] !== label || $[3] !== onClick) {
    t2 = <Btn onClick={onClick} label={label} />;
    $[2] = label;
    $[3] = onClick;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  let t3;
  if ($[5] !== other || $[6] !== t2) {
    t3 = <div>{other}{t2}</div>;
    $[5] = other;
    $[6] = t2;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  return t3;
}