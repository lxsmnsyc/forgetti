import { use, createContext } from 'react';
import { bump } from '../../shared/counter.js';
export const Ctx = createContext('def');
function upper(s) { bump('upper'); return s.toUpperCase(); }
export function HookUseCond({ flag, name }) {
  const shout = upper(name);
  const v = flag ? use(Ctx) : 'none';
  const line = shout + ':' + v;
  return <p>{line}</p>;
}
