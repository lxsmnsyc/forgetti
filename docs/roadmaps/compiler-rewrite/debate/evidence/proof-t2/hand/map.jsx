import { useCache, branch } from './rt.js';
import { bump, Row } from './counter.js';
export function MapList({ items, title }) {
  const $ = useCache(5);
  const rows = branch($, 0, 0);
  const t0 = items.map((item, i) => {
    const c = branch(rows, i, 2);
    if (!Object.is(c[0], item)) {
      c[0] = item;
      c[1] = <Row key={item.id} item={item} />;
    }
    return c[1];
  });
  let t1 = $[1];
  let same = Array.isArray(t1) && t1.length === t0.length;
  for (let i = 0; same && i < t0.length; i++) same = t1[i] === t0[i];
  if (!same) $[1] = t1 = t0;
  if (!Object.is($[2], title) || !Object.is($[3], t1)) {
    $[2] = title;
    $[3] = t1;
    $[4] = <ul title={title}>{t1}</ul>;
  }
  return $[4];
}
