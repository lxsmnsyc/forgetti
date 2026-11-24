import { Panel } from './panel.jsx';
import { double } from './math';

export function Page({ a, b }) {
  const x = double(a);
  return <Panel title="t" value={x} other={b} />;
}
