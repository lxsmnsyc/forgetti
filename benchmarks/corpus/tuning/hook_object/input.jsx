import { useState, useEffect } from 'react';
import { bump } from '../../shared/counter.js';
export function useStats(list, scale) {
  const [n, setN] = useState(0);
  useEffect(() => { globalThis.__setN = setN; }, []);
  bump('total');
  return { total: list.reduce((s, v) => s + v * scale, 0), n };
}
export function HookObject({ list, scale, tag }) {
  const stats = useStats(list, scale);
  return <div>{tag}:{stats.total}:{stats.n}</div>;
}
