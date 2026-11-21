import { useCache, branch } from './rt.js';
import { bump, Child } from './counter.js';
export function Switch({ kind, a, b }) {
  const $ = useCache(5);
  let el;
  switch (kind) {
    case 'a': {
      const c = branch($, 0, 2);
      if (!Object.is(c[0], a)) {
        c[0] = a;
        c[1] = <Child v={a} />;
      }
      el = c[1];
      break;
    }
    case 'b': {
      const c = branch($, 1, 2);
      if (!Object.is(c[0], b)) {
        c[0] = b;
        c[1] = <Child v={b} />;
      }
      el = c[1];
      break;
    }
    default: {
      const c = branch($, 2, 1);
      if (typeof c[0] === "symbol") c[0] = <em>none</em>;
      el = c[0];
    }
  }
  if (!Object.is($[3], el)) {
    $[3] = el;
    $[4] = <div>{el}</div>;
  }
  return $[4];
}
