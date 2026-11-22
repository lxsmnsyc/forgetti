import { useState, useEffect } from 'react';
import { bump, Child } from '../../shared/counter.js';
function useDouble(v) { bump('double'); return v * 2; }
function useLabel(v, tag) {
  const [n, setN] = useState(0);
  useEffect(() => { globalThis.__setN = setN; }, []);
  const d = useDouble(v);
  bump('label');
  return tag + ':' + d + ':' + n;
}
export function HookNested({ v, tag, other }) {
  const label = useLabel(v, tag);
  return <div>{label}<Child v={other} /></div>;
}
