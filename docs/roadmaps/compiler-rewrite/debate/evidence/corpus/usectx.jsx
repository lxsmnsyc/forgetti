import { use, createContext } from 'react';
export const Ctx = createContext('def');
export function UseCtx({ flag, name }) {
  if (flag) {
    const v = use(Ctx);
    return <p>{name}:{v}</p>;
  }
  return <p>{name}</p>;
}
