import { Child, Row } from '../../shared/counter.js';
export function LoopArm({ ok, xs }) {
  return <div>{ok ? xs.map((x) => <Row key={x.id} item={x} />) : <i>none</i>}</div>;
}
export function LoopCallback({ xs, v }) {
  return <ul>{xs.map((x) => (x.on ? <Child v={v} /> : <Row item={x} />))}</ul>;
}
export function LoopNested({ rows }) {
  return <ul>{rows.map((r) => <li key={r.id}>{r.cells.map((c) => <Row key={c.id} item={c} />)}</li>)}</ul>;
}
export function LoopAnd({ xs }) {
  return <ul>{xs && xs.map((x) => <Row item={x} />)}</ul>;
}
export function LoopOf({ xs, t }) {
  const out = [];
  for (const x of xs) {
    out.push(<Row key={x.id} item={x} />);
  }
  return <ul title={t}>{out}</ul>;
}
export function LoopCounter({ n, t }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(<Child key={i} v={t + i} />);
  }
  return <ul>{out}</ul>;
}
export function LoopSkip({ xs, v }) {
  const out = [];
  for (const x of xs) {
    if (x.hide) continue;
    out.push(<Child key={x.id} v={v} />);
  }
  return <ul>{out}</ul>;
}
function Call({ f }) {
  return <b>{f()}</b>;
}
export function LoopVarOf({ xs }) {
  const out = [];
  for (var x of xs) {
    out.push(<Call f={() => x} />);
  }
  return <div>{out}</div>;
}
export function LoopVarCounter({ xs, n }) {
  const out = [];
  for (var i = 0; i < n; i++) {
    out.push(<Call f={() => i + xs[0]} />);
  }
  return <div>{out}</div>;
}
