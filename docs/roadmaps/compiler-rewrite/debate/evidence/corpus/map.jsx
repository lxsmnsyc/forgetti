import { bump, Row } from './counter.js';
export function MapList({ items, title }) {
  return (
    <ul title={title}>
      {items.map((item) => <Row key={item.id} item={item} />)}
    </ul>
  );
}
