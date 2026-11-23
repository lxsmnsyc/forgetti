import { Child } from '../shared/counter.js';

export function Panel({ title, value, other }) {
  return (
    <section>
      <h1>{title}</h1>
      <Child v={value} />
      <em>{other}</em>
    </section>
  );
}
