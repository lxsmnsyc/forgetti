import { bump, Child } from './counter.js';
export function DeepProp(props) {
  const v = props.obj.a.b;
  return <div><Child v={v} />{props.other}</div>;
}
