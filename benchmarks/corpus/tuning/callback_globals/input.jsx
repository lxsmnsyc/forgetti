import { memo } from 'react';
import { bump, Child } from '../../shared/counter.js';

// Calls the function it is given during its own render.
const CallMemo = memo(function CallMemo({ fn }) { bump('CallMemo'); return <b>{fn()}</b>; });
function Call({ fn }) { bump('Call'); return <b>{fn()}</b>; }

function append(list, value) { list.push(value); }

export function GlobalMap({ a, items }) {
  const fn = (i) => i.id + (globalThis.__g || 0);
  return <div>{a}{items.map(fn).join(',')}</div>;
}

export function GlobalMemo({ a, b }) {
  const fn = () => a + (globalThis.__g || 0);
  return <div>{b}<CallMemo fn={fn} /></div>;
}

export function GlobalPlain({ a, b }) {
  const fn = () => a + (globalThis.__g || 0);
  return <div>{b}<Call fn={fn} /></div>;
}

export function PropsFill(props) {
  append(props.items, props.b);
  return <div><Child v={props.a} /><i>{props.items.length}</i></div>;
}
