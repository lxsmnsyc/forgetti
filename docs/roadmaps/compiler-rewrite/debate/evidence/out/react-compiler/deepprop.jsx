import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
export function DeepProp(props) {
  const $ = _c(5);
  const v = props.obj.a.b;
  let t0;
  if ($[0] !== v) {
    t0 = <Child v={v} />;
    $[0] = v;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  let t1;
  if ($[2] !== props.other || $[3] !== t0) {
    t1 = <div>{t0}{props.other}</div>;
    $[2] = props.other;
    $[3] = t0;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  return t1;
}