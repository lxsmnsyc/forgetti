import { c as _c } from "react/compiler-runtime";
import { bump, Child } from './counter.js';
export function JsxProps(props) {
  const $ = _c(8);
  let t0;
  if ($[0] !== props.x) {
    t0 = <Child v={props.x} />;
    $[0] = props.x;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  let t1;
  if ($[2] !== props.y) {
    t1 = <Child v={props.y} />;
    $[2] = props.y;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  let t2;
  if ($[4] !== props.cls || $[5] !== t0 || $[6] !== t1) {
    t2 = <section className={props.cls}>{t0}{t1}</section>;
    $[4] = props.cls;
    $[5] = t0;
    $[6] = t1;
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  return t2;
}