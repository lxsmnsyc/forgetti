import { Child } from '../../shared/counter.js';
export function ControlIf({ k, b }) {
  let el = null;
  if (k) { el = <Child v={b} />; }
  return <div>{el}</div>;
}
export function ControlSwitch({ k, b }) {
  let el = null;
  switch (k) { case 1: el = <Child v={b} />; break; }
  return <div>{el}</div>;
}
export function ControlSkip({ k, b, xs }) {
  let el = null;
  for (const x of xs) { if (k) continue; el = <Child v={b} />; }
  return <div>{el}</div>;
}
export function ControlAnd({ k, b }) {
  let el = null;
  k && (el = <Child v={b} />);
  return <div>{el}</div>;
}
