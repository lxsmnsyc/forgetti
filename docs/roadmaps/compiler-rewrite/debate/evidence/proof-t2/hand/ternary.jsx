import { useCache, branch } from './rt.js';
import { bump, Child } from './counter.js';
export function Ternary({ ok, a, b }) {
  const $ = useCache(2);
  if (ok) {
    const c = branch($, 0, 2);
    if (!Object.is(c[0], a)) {
      c[0] = a;
      c[1] = <div><Child v={a} /></div>;
    }
    return c[1];
  } else {
    const c = branch($, 1, 2);
    if (!Object.is(c[0], b)) {
      c[0] = b;
      c[1] = <span><Child v={b} /></span>;
    }
    return c[1];
  }
}
