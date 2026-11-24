// @ts-nocheck: the counter path resolves only after the harness relinks it.
import { Child } from '../shared/counter.js';

interface ChipProps {
  label: string;
  value: number;
  other: number;
}

export function Chip({ label, value, other }: ChipProps) {
  return (
    <section>
      <h1>{label}</h1>
      <Child v={value} />
      <em>{other}</em>
    </section>
  );
}
