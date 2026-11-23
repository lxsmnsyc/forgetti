import { Chip } from './chip.tsx';
import { scale } from './scale.ts';

export function Page({ a = 1, b }) {
  const x = scale(a);
  return <Chip label="t" value={x} other={b} />;
}
