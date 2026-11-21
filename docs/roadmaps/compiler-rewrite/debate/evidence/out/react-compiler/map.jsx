import { c as _c } from "react/compiler-runtime";
import { bump, Row } from './counter.js';
export function MapList(t0) {
  const $ = _c(5);
  const {
    items,
    title
  } = t0;
  let t1;
  if ($[0] !== items) {
    t1 = items.map(_temp);
    $[0] = items;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] !== t1 || $[3] !== title) {
    t2 = <ul title={title}>{t1}</ul>;
    $[2] = t1;
    $[3] = title;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  return t2;
}
function _temp(item) {
  return <Row key={item.id} item={item} />;
}