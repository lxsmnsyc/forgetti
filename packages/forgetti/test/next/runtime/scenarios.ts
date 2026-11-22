// The package's tsconfig has no DOM types. These tests render into happy-dom.
/// <reference lib="dom" />
import { branch, keep, useCache } from '../../../runtime/next';

// Proof T1 ported: a component whose slots live in a `useRef` cache is rendered by React and
// Preact next to the same component without a cache. HTML after each step and the log of values
// from every render, discarded renders included, must match the uncompiled component.

export type Variant = 'plain' | 'valueFirst' | 'inputsFirst' | 'memo' | 'branch';
export type ScenarioName =
  | 'simple'
  | 'interrupt'
  | 'mount'
  | 'update'
  | 'throw'
  | 'later'
  | 'transition';

export interface Result {
  snaps: string[];
  log: string[];
  calls: number;
}

interface Pair {
  s: string;
}

interface State {
  a: number;
  b: string;
  gate: Gate | null;
  u: number;
  later: boolean;
  epoch: number;
}

export interface Gate {
  promise: Promise<void>;
  done: boolean;
  resolve: () => void;
}

interface BodyProps {
  a: number;
  b: string;
  gate: Gate | null;
  throwLater: boolean;
}

type Component<P> = (props: P) => unknown;

/** What the scenarios need from a renderer. */
export interface Adapter {
  name: string;
  /** True when the renderer can interrupt a render, so the `interrupt` scenario applies. */
  concurrent: boolean;
  useRef: <T>(initial: T) => { current: T };
  useState: <T>(initial: T) => [T, (update: (previous: T) => T) => void];
  useMemo: <T>(create: () => T, inputs: unknown[]) => T;
  h: (type: unknown, props: object | null, ...children: unknown[]) => unknown;
  Suspense: unknown;
  ErrorBoundary: unknown;
  StrictMode: unknown;
  /** Suspends the render while `gate` is pending. */
  suspend: (gate: Gate) => void;
  mount: (el: Element, node: unknown) => void;
  unmount: (el: Element) => void;
  transition: (run: () => void) => void;
  flush: (run: () => void) => void;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function busy(ms: number): void {
  const start = performance.now();
  while (performance.now() - start < ms) {
    // Spin, so React yields in the middle of a transition.
  }
}

export function createGate(): Gate {
  let resolve = (): void => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const gate: Gate = {
    promise,
    done: false,
    resolve() {
      gate.done = true;
      resolve();
    },
  };
  return gate;
}

let log: string[] = [];
let calls = 0;

function computeA(a: number): Pair {
  calls++;
  return { s: `A${a}` };
}

function computeB(a: number, b: string): Pair {
  calls++;
  if (b === 'bad') {
    throw new Error('bad f1');
  }
  return { s: `${a}${b}` };
}

function computeD(v: Pair): Pair {
  calls++;
  return { s: `D${v.s}` };
}

/** Hand-written slot code. The `valueFirst` write order is the rule, `inputsFirst` breaks it. */
function createBody(adapter: Adapter, variant: Variant): Component<BodyProps> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- slots hold what this component stored. */
  return function Body({ a, b, gate, throwLater }) {
    let v0: Pair;
    let v1: Pair;
    let v2: Pair;
    if (variant === 'plain') {
      v0 = computeA(a);
      v1 = computeB(a, b);
      v2 = computeD(v1);
    } else if (variant === 'memo') {
      v0 = adapter.useMemo(() => computeA(a), [a]);
      v1 = adapter.useMemo(() => computeB(a, b), [a, b]);
      v2 = adapter.useMemo(() => computeD(v1), [v1]);
    } else if (variant === 'branch') {
      // The same slots in a child cache, with `keep` holding the input tuples.
      const c = branch(useCache(adapter.useRef, 1), 0, 9);
      const first = keep(c, 7, [a]);
      if (c[0] === first) {
        v0 = c[1] as Pair;
      } else {
        v0 = computeA(a);
        c[0] = first;
        c[1] = v0;
      }
      const second = keep(c, 8, [a, b]);
      if (c[2] === second) {
        v1 = c[4] as Pair;
      } else {
        v1 = computeB(a, b);
        c[2] = second;
        c[4] = v1;
      }
      if (c[5] === v1) {
        v2 = c[6] as Pair;
      } else {
        v2 = computeD(v1);
        c[5] = v1;
        c[6] = v2;
      }
    } else {
      const c = useCache(adapter.useRef, 9);
      const valueFirst = variant === 'valueFirst';
      if (c[0] === a) {
        v0 = c[1] as Pair;
      } else if (valueFirst) {
        v0 = computeA(a);
        c[0] = a;
        c[1] = v0;
      } else {
        c[0] = a;
        c[1] = computeA(a);
        v0 = c[1] as Pair;
      }
      if (c[2] === a && c[3] === b) {
        v1 = c[4] as Pair;
      } else if (valueFirst) {
        v1 = computeB(a, b);
        c[2] = a;
        c[3] = b;
        c[4] = v1;
      } else {
        c[2] = a;
        c[3] = b;
        c[4] = computeB(a, b);
        v1 = c[4] as Pair;
      }
      if (c[5] === v1) {
        v2 = c[6] as Pair;
      } else if (valueFirst) {
        v2 = computeD(v1);
        c[5] = v1;
        c[6] = v2;
      } else {
        c[5] = v1;
        c[6] = computeD(v1);
        v2 = c[6] as Pair;
      }
    }
    if (gate) {
      adapter.suspend(gate);
    }
    if (throwLater) {
      throw new Error('later');
    }
    log.push(`body ${a}${b}${gate ? 'G' : ''} -> ${v0.s},${v1.s},${v2.s}`);
    return adapter.h('p', null, `${v0.s}|${v1.s}|${v2.s}`);
  };
}

export async function runScenario(
  adapter: Adapter,
  variant: Variant,
  scenario: ScenarioName,
  strict: boolean,
): Promise<Result> {
  log = [];
  calls = 0;
  const Body = createBody(adapter, variant);
  const el = document.createElement('div');
  document.body.append(el);
  const snaps: string[] = [];
  function snap(label: string): void {
    snaps.push(`${label}: ${el.innerHTML}`);
  }
  function wrap(node: unknown): unknown {
    return strict ? adapter.h(adapter.StrictMode, null, node) : node;
  }
  const slow = scenario === 'interrupt';
  let hook: (() => void) | null = null;
  function Slow(props: { tag: string }): null {
    hook?.();
    log.push(`slow ${props.tag}`);
    busy(12);
    return null;
  }
  let setApp: (update: (previous: State) => State) => void = () => {};
  function App(): unknown {
    const [s, set] = adapter.useState<State>({
      a: 1,
      b: 'x',
      gate: null,
      u: 0,
      later: false,
      epoch: 0,
    });
    setApp = set;
    return adapter.h(
      adapter.ErrorBoundary,
      { key: s.epoch },
      adapter.h(
        adapter.Suspense,
        { fallback: adapter.h('b', null, 'FB') },
        adapter.h(Body, { a: s.a, b: s.b, gate: s.gate, throwLater: s.later }),
        slow ? adapter.h(Slow, { tag: `u${s.u}a${s.a}` }) : null,
        slow ? adapter.h(Slow, { tag: '2' }) : null,
        adapter.h('u', null, s.u),
      ),
    );
  }
  function update(next: Partial<State>): void {
    setApp((previous) => ({ ...previous, ...next }));
  }
  function transition(next: Partial<State>): void {
    adapter.transition(() => {
      update(next);
    });
  }

  if (scenario === 'simple') {
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(50);
    snap('mount');
    update({ a: 2 });
    await sleep(50);
    snap('a2');
    update({ u: 1 });
    await sleep(50);
    snap('u1 same inputs');
    update({ b: 'z' });
    await sleep(50);
    snap('bz');
  } else if (scenario === 'interrupt') {
    // A transition render is interrupted by an urgent update fired during the first slow sibling.
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(400);
    snap('mount');
    let fired = false;
    hook = () => {
      if (!fired) {
        fired = true;
        setImmediate(() => {
          log.push('-- urgent');
          adapter.flush(() => {
            update({ u: 1 });
          });
        });
      }
    };
    transition({ a: 2 });
    await sleep(300);
    snap('after');
    fired = false;
    transition({ a: 3, b: 'y' });
    await sleep(300);
    snap('after2');
    hook = null;
  } else if (scenario === 'mount') {
    // Suspends on first mount after the slots are computed.
    const gate = createGate();
    function Root(): unknown {
      return adapter.h(
        adapter.Suspense,
        { fallback: adapter.h('b', null, 'FB') },
        adapter.h(Body, { a: 5, b: 'q', gate, throwLater: false }),
      );
    }
    adapter.mount(el, wrap(adapter.h(Root, null)));
    await sleep(400);
    snap('suspended');
    gate.resolve();
    await sleep(400);
    snap('resolved');
  } else if (scenario === 'update') {
    // Suspends on update, then resolves, or is abandoned for other props.
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(400);
    snap('mount');
    const p = createGate();
    const q = createGate();
    transition({ a: 2, gate: p });
    await sleep(400);
    snap('t suspended a2');
    transition({ a: 3, gate: null });
    await sleep(400);
    snap('t a3 different props');
    p.resolve();
    await sleep(400);
    snap('p resolved');
    transition({ a: 4, gate: q });
    await sleep(400);
    snap('t suspended a4');
    transition({ a: 3, gate: null });
    await sleep(400);
    snap('t abandoned back to a3');
    q.resolve();
    await sleep(400);
    snap('q resolved');
    const r = createGate();
    update({ a: 6, gate: r });
    await sleep(400);
    snap('urgent suspended a6');
    r.resolve();
    await sleep(400);
    snap('r resolved');
    const t = createGate();
    update({ a: 7, gate: t });
    await sleep(400);
    snap('urgent suspended a7');
    update({ a: 6, gate: null });
    await sleep(400);
    snap('urgent a6 again');
  } else if (scenario === 'throw') {
    // A computation throws on an update, the boundary shows the error, then props recover.
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(50);
    snap('mount ok');
    update({ b: 'bad' });
    await sleep(50);
    snap('f1 throws on update');
    update({ b: 'x', a: 1, epoch: 1 });
    await sleep(50);
    snap('after error, props ok');
  } else if (scenario === 'later') {
    // A throw after every slot is written.
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(50);
    snap('mount');
    update({ a: 2 });
    await sleep(50);
    snap('a2');
    update({ later: true });
    await sleep(50);
    snap('throwLater');
  } else {
    // A computation throws inside a transition and the renderer retries it at once.
    adapter.mount(el, wrap(adapter.h(App, null)));
    await sleep(50);
    snap('mount');
    transition({ b: 'bad' });
    await sleep(400);
    snap('transition throws');
  }
  adapter.unmount(el);
  el.remove();
  return { snaps, log: [...log], calls };
}
