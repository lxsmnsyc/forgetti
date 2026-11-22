import { bump, Child } from '../../shared/counter.js';
export function Mutate({ a, b, c }) {
  const arr = [a];
  arr.push(b);
  const label = c + '!';
  return <div>{label}{arr.map((v, i) => <Child key={i} v={v} />)}</div>;
}
