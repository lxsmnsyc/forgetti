import { bump, Child } from '../../shared/counter.js';
export function DeepProp(props) {
  const v = props.obj.a.b;
  return <div><Child v={v} />{props.other}</div>;
}
