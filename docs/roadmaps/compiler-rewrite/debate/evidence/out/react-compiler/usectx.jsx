import { c as _c } from "react/compiler-runtime";
import { use, createContext } from 'react';
export const Ctx = createContext('def');
export function UseCtx(t0) {
  const $ = _c(5);
  const {
    flag,
    name
  } = t0;
  if (flag) {
    const v = use(Ctx);
    let t1;
    if ($[0] !== name || $[1] !== v) {
      t1 = <p>{name}:{v}</p>;
      $[0] = name;
      $[1] = v;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    return t1;
  }
  let t1;
  if ($[3] !== name) {
    t1 = <p>{name}</p>;
    $[3] = name;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  return t1;
}