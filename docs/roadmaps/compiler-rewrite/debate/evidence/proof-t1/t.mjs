import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
const React = (await import('react')).default ?? await import('react');
const { createElement: h, useRef, useMemo, use, Suspense, StrictMode, startTransition, Component, useState, useEffect } = await import('react');
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const _ce=console.error; console.error=()=>{}; console.log('NODE_ENV', process.env.NODE_ENV, React.version);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const busy = ms => { const t = performance.now(); while (performance.now() - t < ms); };

function useCache(size){ const r = useRef(null); if (r.current === null) r.current = new Array(size); return r.current; }

let LOG, CALLS;
const f0 = a => { CALLS.push('f0'); return { s: 'A' + a }; };
const f1 = (a, b) => { CALLS.push('f1'); if (b === 'bad') throw new Error('bad f1'); return { s: a + b }; };
const f2 = v => { CALLS.push('f2'); return { s: 'D' + (v && v.s) }; };

function makeBody(variant) {
  return function Body({ a, b, gate, throwLater }) {
    let v0, v1, v2;
    if (variant === 'plain') { v0 = f0(a); v1 = f1(a, b); v2 = f2(v1); }
    else if (variant === 'memo') {
      v0 = useMemo(() => f0(a), [a]); v1 = useMemo(() => f1(a, b), [a, b]); v2 = useMemo(() => f2(v1), [v1]);
    } else {
      const c = useCache(9);
      const vt = variant === 'refV';
      if (c[0] !== a) { if (vt) { v0 = f0(a); c[0] = a; c[1] = v0; } else { c[0] = a; c[1] = f0(a); v0 = c[1]; } } else v0 = c[1];
      if (c[2] !== a || c[3] !== b) { if (vt) { v1 = f1(a, b); c[2] = a; c[3] = b; c[4] = v1; } else { c[2] = a; c[3] = b; c[4] = f1(a, b); v1 = c[4]; } } else v1 = c[4];
      if (c[5] !== v1) { if (vt) { v2 = f2(v1); c[5] = v1; c[6] = v2; } else { c[5] = v1; c[6] = f2(v1); v2 = c[6]; } } else v2 = c[6];
    }
    if (gate) use(gate);
    if (throwLater) throw new Error('later');
    LOG.push(`body ${a}${b}${gate ? 'G' : ''} -> ${v0.s},${v1 && v1.s},${v2.s}`);
    return h('p', null, `${v0.s}|${v1 && v1.s}|${v2.s}`);
  };
}
class EB extends Component {
  state = { err: null };
  static getDerivedStateFromError(e) { return { err: e.message }; }
  render() { return this.state.err ? h('i', null, 'ERR:' + this.state.err) : this.props.children; }
}
function Slow({ tag }) { globalThis.__hook && globalThis.__hook(); LOG.push('slow ' + tag); busy(12); return null; }

async function run(variant, scenario, strict) {
  LOG = []; CALLS = [];
  const Body = makeBody(variant);
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  const snaps = [];
  const snap = l => snaps.push(l + ': ' + el.innerHTML);
  const wrap = x => strict ? h(StrictMode, null, x) : x;
  let setApp;
  function App() {
    const [s, set] = useState({ a: 1, b: 'x', gate: null, u: 0, later: false });
    setApp = set;
    return h(EB, null, h(Suspense, { fallback: h('b', null, 'FB') },
      h(Body, { a: s.a, b: s.b, gate: s.gate, throwLater: s.later }),
      scenario === 'a' ? h(Slow, { tag: 'u' + s.u + 'a' + s.a }) : null,
      scenario === 'a' ? h(Slow, { tag: '2' }) : null,
      h('u', null, s.u)));
  }
  const upd = f => setApp(p => ({ ...p, ...f }));
  const trans = f => startTransition(() => upd(f));
  const mk = () => { let res; const p = new Promise(r => res = r); return [p, res]; };
  if (scenario === 'a') {
    root.render(wrap(h(App))); await sleep(100); snap('mount');
    // transition, interrupted by urgent update fired during first slow sibling
    let fired = false;
    globalThis.__hook = () => { if (!fired) { fired = true; setImmediate(() => { LOG.push('-- urgent'); flushSync(() => upd({ u: 1 })); }); } };
    trans({ a: 2 }); await sleep(300); snap('after');
    // second round: interrupt with urgent that changes same inputs back
    fired = false; trans({ a: 3, b: 'y' }); await sleep(300); snap('after2'); globalThis.__hook = null;
  } else if (scenario === 'b') {
    const [p, res] = mk();
    const el2 = document.createElement('div'); document.body.appendChild(el2);
    const r2 = createRoot(el2);
    function App2() { return h(Suspense, { fallback: h('b', null, 'FB') }, h(Body, { a: 5, b: 'q', gate: p })); }
    r2.render(wrap(h(App2))); await sleep(400); snaps.push('suspended: ' + el2.innerHTML);
    res(); await sleep(400); snaps.push('resolved: ' + el2.innerHTML);
  } else if (scenario === 'c') {
    root.render(wrap(h(App))); await sleep(400); snap('mount');
    const [p, res] = mk(); const [q, resq] = mk();
    trans({ a: 2, gate: p }); await sleep(400); snap('t suspended a2');
    trans({ a: 3, gate: null }); await sleep(400); snap('t a3 different props');
    res(); await sleep(400); snap('p resolved');
    trans({ a: 4, gate: q }); await sleep(400); snap('t suspended a4');
    trans({ a: 3, gate: null }); await sleep(400); snap('t abandoned back to a3');
    resq(); await sleep(400); snap('q resolved');
    // urgent (non-transition) suspend: fallback shown, then resolve
    const [r, resr] = mk(); upd({ a: 6, gate: r }); await sleep(400); snap('urgent suspended a6');
    resr(); await sleep(400); snap('r resolved');
    const [t2, rest2] = mk(); upd({ a: 7, gate: t2 }); await sleep(400); snap('urgent suspended a7');
    upd({ a: 6, gate: null }); await sleep(400); snap('urgent a6 again');
  } else if (scenario === 'e') {
    root.render(wrap(h(App))); await sleep(50); snap('mount ok');
    upd({ b: 'bad' }); await sleep(50); snap('f1 throws on update');
    upd({ b: 'x', a: 1 }); await sleep(50); snap('after error, props ok (boundary stays)');
  } else if (scenario === 'e2') {
    // boundary resets by remount of child while same props: need survive; test throw in f then same inputs retry
    root.render(wrap(h(App))); await sleep(50); snap('mount');
    upd({ a: 2 }); await sleep(50); snap('a2');
    upd({ later: true }); await sleep(50); snap('throwLater');
  } else if (scenario === 'e3') {
    // error on update inside transition: React retries sync
    root.render(wrap(h(App))); await sleep(50); snap('mount');
    trans({ b: 'bad' }); await sleep(100); snap('transition f1 throws');
  } else if (scenario === 'simple') {
    root.render(wrap(h(App))); await sleep(50); snap('mount');
    upd({ a: 2 }); await sleep(50); snap('a2'); upd({ u: 1 }); await sleep(50); snap('u1 same inputs'); upd({ b: 'z' }); await sleep(50); snap('bz');
  }
  root.unmount?.();
  return { snaps, log: LOG.slice(), calls: CALLS.length };
}
// hook for scenario a: Slow calls __hook
const OrigSlow = Slow;
const variants = ['plain', 'refV', 'refD', 'memo'];
const scenarios = ['simple', 'a', 'b', 'c', 'e', 'e2', 'e3'];
const out = {};
for (const strict of [false, true]) for (const sc of scenarios) {
  const res = {};
  for (const v of variants) res[v] = await run(v, sc, strict);
  const key = JSON.stringify;
  console.log(`\n=== scenario ${sc} strict=${strict} ===`);
  console.log('PLAIN snaps:', res.plain.snaps.join(' | '));
  console.log('PLAIN log:', res.plain.log.join(' ; '));
  for (const v of variants.slice(1)) {
    const sd = key(res[v].snaps) === key(res.plain.snaps), ld = key(res[v].log) === key(res.plain.log);
    console.log(v, 'html', sd ? 'same' : 'DIFF', 'log', ld ? 'same' : 'DIFF', 'calls', res[v].calls, 'vs', res.plain.calls);
    if (!sd) console.log('   snaps:', res[v].snaps.join(' | '));
    if (!ld) console.log('   log:', res[v].log.join(' ; '));
  }
}
process.exit(0);
