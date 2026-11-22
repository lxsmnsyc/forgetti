import { useState, useEffect, useDeferredValue } from 'react';
import { bump, Child } from '../../shared/counter.js';
function slow(n) { bump('slow'); return n * 10; }
export function Transition({ list, tag }) {
  const [n, setN] = useState(0);
  const deferred = useDeferredValue(n);
  useEffect(() => { globalThis.__setN = setN; }, []);
  const now = slow(n);
  const lagged = slow(deferred);
  return <div>{tag}:{now}:{lagged}<Child v={list.length} /></div>;
}
