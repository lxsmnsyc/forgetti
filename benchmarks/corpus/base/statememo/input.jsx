import { useState, useMemo, useEffect } from 'react';
import { bump } from '../../shared/counter.js';
function sumOf(list) { bump('total'); return list.reduce((s, v) => s + v, 0); }
export function StateMemo({ list, tag }) {
  const [n, setN] = useState(0);
  const total = useMemo(() => sumOf(list), [list]);
  useEffect(() => { globalThis.__setN = setN; }, []);
  return <div>{tag}:{total}:{n}</div>;
}
