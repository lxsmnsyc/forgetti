import { bump, Row } from '../../shared/counter.js';
export function ForLoop({ items, title }) {
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    rows.push(<Row key={i} item={items[i]} />);
  }
  return <ul title={title}>{rows}</ul>;
}
