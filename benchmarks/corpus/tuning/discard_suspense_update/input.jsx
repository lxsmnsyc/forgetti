import { Suspense, use } from 'react';
import { bump } from '../../shared/counter.js';
function fmt(tag) { bump('fmt'); return '<' + tag + '>'; }
function Data({ res, tag }) {
  const label = fmt(tag);
  const value = use(res.promise);
  return <p>{label}:{value}</p>;
}
export function SuspenseUpdate({ res, tag }) {
  return <Suspense fallback={<b>wait</b>}><Data res={res} tag={tag} /></Suspense>;
}
