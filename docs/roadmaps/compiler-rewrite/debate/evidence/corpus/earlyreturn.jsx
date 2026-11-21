import { bump, Child } from './counter.js';
function costly(k, v) { bump(k); return v * 2; }
export function EarlyReturn({ loading, a, b }) {
  const head = costly('head', a);
  if (loading) return <p>loading</p>;
  const body = costly('body', b);
  return <div><Child v={head} />{body}</div>;
}
