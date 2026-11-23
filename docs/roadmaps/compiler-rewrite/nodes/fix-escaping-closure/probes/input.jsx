import { useRef, useState, useEffect } from 'react';
import { bump, Child } from '../../shared/counter.js';

let tick = 0;
let outer = null;

// Helper reads a module let that changes between renders of the same props.
export function HelperGlobal({ a }) {
  const row = (x) => (
    <b>
      {x}
      {globalThis.__g}
      {tick}
    </b>
  );
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Helper changes a captured array, called twice, length read after.
export function HelperMutates({ a }) {
  const log = [];
  const row = (x) => {
    log.push(x);
    return <b>{log.length}</b>;
  };
  return (
    <div>
      {row(a)}
      {row(a)}
      <Child v={log.length} />
    </div>
  );
}

// Helper changes its argument.
export function HelperArg({ a }) {
  const list = [a];
  const row = (l) => {
    l.push(1);
    return <b>{l.length}</b>;
  };
  return (
    <div>
      {row(list)}
      {row(list)}
      <Child v={list.length} />
    </div>
  );
}

// Helper reads a ref that changes without a render of its own.
export function HelperRef({ a }) {
  const ref = useRef(0);
  ref.current += 1;
  const row = (x) => (
    <b>
      {x}
      {ref.current}
    </b>
  );
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Helper reads state and props that change.
export function HelperState({ a }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    globalThis.__setN = setN;
  }, []);
  const row = (x) => (
    <b>
      {x}
      {n}
    </b>
  );
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Closure stored in a ref and called later.
export function StoredInRef({ a }) {
  const ref = useRef(null);
  const show = () => a;
  ref.current = show;
  useEffect(() => {
    globalThis.__call = () => ref.current();
  });
  const row = () => <b>{a}</b>;
  return (
    <div>
      {row()}
      {row()}
    </div>
  );
}

// Closure given to an effect, reading props that change.
export function EffectClosure({ a }) {
  const row = (x) => <b>{x}</b>;
  useEffect(() => {
    globalThis.__seen = a;
  });
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Closure assigned to an outer variable, called after a re-render.
export function OuterAssign({ a }) {
  const row = (x) => <b>{x}</b>;
  outer = () => a;
  globalThis.__outer = outer;
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Helper that reads a global that changes.
export function HelperTick({ a }) {
  tick += 1;
  const row = (x) => <b>{x + tick}</b>;
  return (
    <div>
      {row(a)}
      {row(a)}
    </div>
  );
}

// Helper returned from a function that is called during render.
function useRows(a) {
  const row = (x) => <b>{x + a}</b>;
  return row;
}

export function HookHelper({ a, b }) {
  const row = useRows(a);
  return (
    <div>
      {row(b)}
      {row(b)}
    </div>
  );
}

// Handler that reads a prop and is called after a re-render.
export function LaterCall({ a }) {
  const [n, setN] = useState(0);
  const label = (x) => `${x}:${n}`;
  const onClick = () => {
    globalThis.__label = label(a);
  };
  useEffect(() => {
    globalThis.__click = onClick;
    globalThis.__setN2 = setN;
  });
  return (
    <div onClick={onClick}>
      {label(a)}
      {label(a)}
    </div>
  );
}

function sink(o) {
  o.n += 1;
}

const util = {
  inc(o) {
    o.n += 1;
  },
};

// A module function changes the captured object it is given.
export function PassSink({ a }) {
  const box = { n: a };
  const row = () => {
    sink(box);
    return <b>{box.n}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{box.n}</i>
    </div>
  );
}

// A local closure pushes to the array it is given.
export function PassAdd({ a }) {
  const list = [];
  const add = (l) => {
    l.push(a);
  };
  const row = () => {
    add(list);
    return <b>{list.length}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{list.length}</i>
    </div>
  );
}

// A method of a module object changes the captured object.
export function PassMethod({ a }) {
  const box = { n: a };
  const row = () => {
    util.inc(box);
    return <b>{box.n}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{box.n}</i>
    </div>
  );
}

// The change is two helpers deep.
export function PassNested({ a }) {
  const list = [];
  const add = (l) => {
    l.push(a);
  };
  const inner = () => {
    add(list);
  };
  const row = () => {
    inner();
    return <b>{list.length}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{list.length}</i>
    </div>
  );
}

// The captured object is passed in a spread array.
export function PassSpread({ a }) {
  const box = { n: a };
  const row = () => {
    sink(...[box]);
    return <b>{box.n}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{box.n}</i>
    </div>
  );
}

// The captured object is passed through an alias.
export function PassAlias({ a }) {
  const box = { n: a };
  const row = () => {
    const b2 = box;
    sink(b2);
    return <b>{box.n}</b>;
  };
  return (
    <div>
      {row()}
      {row()}
      <i>{box.n}</i>
    </div>
  );
}

// A pure global reads the captured object: the helper may stay cached.
export function PassRead({ a, b }) {
  const box = { n: a };
  const row = (x) => <b>{Math.max(box.n, x)}</b>;
  return (
    <div>
      {row(b)}
      {row(b)}
    </div>
  );
}
