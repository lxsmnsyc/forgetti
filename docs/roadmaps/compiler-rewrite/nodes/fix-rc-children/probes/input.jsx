import { memo, forwardRef, useRef } from 'react';
import { bump, Child } from '../../shared/counter.js';

// Wrappers: `memo` with a comparator and `forwardRef` can render again on equal props.
const Always = memo(function Always({ id }) {
  bump('Row');
  return <u>{id + ':' + (globalThis.__g || 0)}</u>;
}, () => false);

const Fwd = forwardRef(function Fwd({ id }, ref) {
  bump('Row');
  return <u ref={ref}>{id + ':' + (globalThis.__g || 0)}</u>;
});

const Plain = memo(function Plain({ id }) {
  bump('Row');
  return <u>{id + ':' + (globalThis.__g || 0)}</u>;
});

export function Wrappers({ id }) {
  return (
    <div>
      <Always id={id} />
      <Fwd id={id} />
      <Plain id={id} />
    </div>
  );
}

// A let written in a closure that render calls.
export function LetClosure({ items }) {
  let count = 0;
  items.forEach(() => {
    count += 1;
  });
  return <Child v={'n' + count} />;
}

// A let written after an element that reads it.
export function LetAfter({ a, b }) {
  let label = a;
  const first = <Child v={'first ' + label} />;
  label = b;
  return (
    <div>
      {first}
      <Child v={'second ' + label} />
    </div>
  );
}

// A let captured by a closure that a child calls during render, written after the closure.
function Call({ fn }) {
  bump('Row');
  return <b>{fn()}</b>;
}

export function LetCaptured({ a, b }) {
  let n = a;
  const get = () => n + '!';
  n = b;
  return <Call fn={get} />;
}

// A let moved by a loop and a switch.
export function LetLoop({ n, kind }) {
  let i = 0;
  while (i < n) {
    i += 1;
  }
  let word;
  switch (kind) {
    case 'a':
      word = 'A';
      break;
    default:
      word = 'Z';
  }
  return (
    <div>
      <Child v={'i' + i} />
      <Child v={word + i} />
    </div>
  );
}

// A let that holds an object changed after it was read.
export function LetObject({ a, b }) {
  let o = { k: a };
  const el = <Child v={'o ' + o.k} />;
  o.k = b;
  return (
    <div>
      {el}
      <Child v={'then ' + o.k} />
    </div>
  );
}

// A let set in try and catch.
function risky(x) {
  if (x === 'bad') {
    throw new Error('bad');
  }
  return x + '+';
}

export function LetTry({ x }) {
  let out = 'none';
  try {
    out = risky(x);
  } catch (e) {
    out = 'caught';
  }
  return <Child v={`${out}/${x.length}`} />;
}

// Key expressions: a primitive built from a property of an object that render changes.
export function KeyMutated({ a, b }) {
  const box = { first: a };
  box.second = b;
  const list = [a];
  if (b) {
    list.push(b);
  }
  return (
    <div>
      <Child v={`${box.first}-${box.second}`} />
      <Child v={`len ${list.length}`} />
    </div>
  );
}

let level = 0;
export function setLevel(next) {
  level = next;
}
function readLevel() {
  return level;
}

export function KeyHidden({ a }) {
  const ref = useRef(a);
  ref.current = a.x;
  return (
    <div>
      <Child v={`${a.x}${readLevel()}`} />
      <Child v={`${a.x}${globalThis.__g || 0}`} />
      <Child v={`${a.x}${ref.current}`} />
    </div>
  );
}

// A group built from a let, which changes after the group was built.
export function LetGroup({ a, b }) {
  let base = a;
  const obj = { v: base };
  base = b;
  return <Child v={`${obj.v}/${base}`} />;
}

// A write guarded by a let that changes after the write.
export function LetGuard({ x, y }) {
  let flag = x;
  const o = {};
  if (flag) {
    o.k = y;
  }
  flag = !flag;
  return <Child v={`${o.k}/${flag}`} />;
}

// A call changes a property in place, then a key expression reads it.
function touch(o) {
  o.x = (o.x || 0) + 1;
}

export function KeyTouched({ a }) {
  touch(a);
  return <Child v={`x ${a.x}`} />;
}

export function KeyTouchedMember(props) {
  touch(props.a);
  return <Child v={`x ${props.a.x}`} />;
}

export function KeyTouchedPlain({ a }) {
  touch(a);
  return <Child v={a.x} />;
}

// A let read in a hoisted conditional, after a conditional write.
export function LetBranch({ a, b, show }) {
  let t = a;
  if (b) {
    t = b;
  }
  return <div>{show ? <Child v={`${t}!`} /> : null}</div>;
}

// A let that a closure and a loop add to, read by elements built in them.
export function LetAccumulate({ items }) {
  let acc = 0;
  const first = items.map((i) => {
    acc += i;
    return <Child key={i} v={'m' + acc} />;
  });
  let sum = 0;
  const second = [];
  for (const i of items) {
    sum += i;
    second.push(<Child key={i} v={'l' + sum} />);
  }
  return (
    <div>
      {first}
      {second}
    </div>
  );
}

// A let that early returns see in different states.
export function LetEarly({ a, b }) {
  let x = a;
  if (b) {
    x = b + a;
    return <Child v={`early ${x}`} />;
  }
  return <Child v={`late ${x}`} />;
}

// A list that grows after an element read its length.
export function KeyGrow({ a, b }) {
  const list = [a];
  const first = <Child v={`first ${list.length}`} />;
  list.push(b);
  return (
    <div>
      {first}
      <Child v={`second ${list.length}`} />
    </div>
  );
}
