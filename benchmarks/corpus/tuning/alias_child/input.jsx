import { Child } from '../../shared/counter.js';
export function AliasChild({ a, b, pick }) {
  const v = pick(a, b);
  return <div><Child v={v} /><Child v={b} /></div>;
}
