import { bump } from '../../shared/counter.js';
export function AliasClosure({ list, tag }) {
  const out = [];
  const add = (v) => { out.push(v * 2); };
  for (const v of list) { add(v); }
  bump('build');
  return <p>{tag}:{out.join(',')}</p>;
}
