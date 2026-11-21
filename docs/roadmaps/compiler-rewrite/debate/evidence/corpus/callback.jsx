import { bump, Btn } from './counter.js';
export function Callback({ id, label, other }) {
  const onClick = () => { globalThis.__clicked = id; };
  return <div>{other}<Btn onClick={onClick} label={label} /></div>;
}
