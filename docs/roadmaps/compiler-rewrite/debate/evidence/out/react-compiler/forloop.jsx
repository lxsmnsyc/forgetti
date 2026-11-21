import { c as _c } from "react/compiler-runtime";
import { bump, Row } from './counter.js';
export function ForLoop(t0) {
  const $ = _c(5);
  const {
    items,
    title
  } = t0;
  let rows;
  if ($[0] !== items) {
    rows = [];
    for (let i = 0; i < items.length; i++) {
      rows.push(<Row key={i} item={items[i]} />);
    }
    $[0] = items;
    $[1] = rows;
  } else {
    rows = $[1];
  }
  let t1;
  if ($[2] !== rows || $[3] !== title) {
    t1 = <ul title={title}>{rows}</ul>;
    $[2] = rows;
    $[3] = title;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  return t1;
}