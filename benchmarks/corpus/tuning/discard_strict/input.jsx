import { StrictMode, useState, useEffect } from 'react';
import { bump } from '../../shared/counter.js';
function sumOf(list) { bump('sum'); return list.reduce((s, v) => s + v, 0); }
function Inner({ list, tag }) {
  const [n, setN] = useState(0);
  const total = sumOf(list);
  useEffect(() => { bump('effect'); globalThis.__setN = setN; return () => { bump('cleanup'); }; }, [tag]);
  return <p>{tag}:{total}:{n}</p>;
}
export function Strict({ list, tag }) {
  return <StrictMode><Inner list={list} tag={tag} /></StrictMode>;
}
