import { bump, Child } from './counter.js';
export function Switch({ kind, a, b }) {
  let el;
  switch (kind) {
    case 'a': el = <Child v={a} />; break;
    case 'b': el = <Child v={b} />; break;
    default: el = <em>none</em>;
  }
  return <div>{el}</div>;
}
