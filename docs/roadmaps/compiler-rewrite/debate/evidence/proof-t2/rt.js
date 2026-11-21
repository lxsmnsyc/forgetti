import { useRef } from 'react';
const U = Symbol();
export function useCache(n) { const r = useRef(null); return r.current ||= new Array(n).fill(U); }
export function branch(p, i, n) { return p[i] === U || p[i] === undefined ? (p[i] = new Array(n).fill(U)) : p[i]; }
