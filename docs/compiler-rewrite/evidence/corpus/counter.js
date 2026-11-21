import { createElement, memo } from 'react';
export const C = {};
export function bump(k) { C[k] = (C[k] || 0) + 1; }
export function reset() { for (const k in C) delete C[k]; }
// Uncompiled child components with honest render counters.
export function Child({ v }) { bump('Child'); return createElement('i', null, v); }
export function Row({ item }) { bump('Row'); return createElement('li', null, typeof item === 'object' ? item.name : item); }
export const Btn = memo(function Btn({ onClick, label }) { bump('Btn'); return createElement('button', { onClick }, label); });
