import { bump, Child } from '../../shared/counter.js';
export function Ternary({ ok, a, b }) {
  return ok ? <div><Child v={a} /></div> : <span><Child v={b} /></span>;
}
