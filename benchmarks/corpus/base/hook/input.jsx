import { bump } from '../../shared/counter.js';
function costly(k, v) { bump(k); return v * 2; }
function useThing(a, b) {
  const x = costly('x', a);
  const y = costly('y', b);
  return { x, y };
}
export function HookUser({ a, b }) {
  const { x, y } = useThing(a, b);
  return <b>{x}:{y}</b>;
}
