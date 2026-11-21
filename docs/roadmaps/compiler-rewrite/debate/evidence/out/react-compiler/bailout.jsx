import { useRef } from 'react';
import { bump, Child } from './counter.js';
export function Bailout(props) {
  const ref = useRef(0);
  props.box.n += 1;
  ref.current = ref.current + 1;
  const seen = ref.current;
  return <div><Child v={props.a} />{seen > 0 ? props.box.n : 0}</div>;
}