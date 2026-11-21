import { bump } from './counter.js';
function risky(v) { bump('risky'); if (v < 0) throw new Error('neg'); return v * 2; }
export function TryCatch({ a, label }) {
  let out;
  try {
    out = risky(a);
  } catch (e) {
    out = 'err';
  }
  return <div>{label}:{out}</div>;
}
