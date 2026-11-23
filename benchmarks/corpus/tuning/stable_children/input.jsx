import { memo } from 'react';
import { bump, Child } from '../../shared/counter.js';

// A memo child created by a wrapper call at module level.
const Tile = memo(function Tile({ item, onPick }) {
  bump('Row');
  return <button onClick={onPick}>{item.label}</button>;
});

const Badge = memo(function Badge({ text }) {
  bump('Row');
  return <b>{text}</b>;
});

function formatPrice(value) {
  bump('format');
  return value.toFixed(2);
}

export function Picker({ items, onPick, heading }) {
  return (
    <section>
      <h4>{heading}</h4>
      {items.map((item) => (
        <Tile key={item.id} item={item} onPick={() => onPick(item.id)} />
      ))}
    </section>
  );
}

export function Totals({ entries, currency }) {
  let sum = 0;
  let top = null;
  for (const entry of entries) {
    sum += entry.amount;
    if (top === null || entry.amount > top.amount) {
      top = entry;
    }
  }
  return (
    <div>
      <i>{currency + formatPrice(sum)}</i>
      <Child v={top ? `top: ${top.name}` : 'empty'} />
      <Badge text={sum > 100 ? 'big' : 'small'} />
    </div>
  );
}

export function Mode({ user, flag }) {
  let title = 'guest';
  if (user) {
    title = user.name;
  }
  let tone = 'plain';
  if (flag) {
    tone = 'loud';
  }
  return (
    <div>
      <Badge text={title} />
      <Child v={`${tone}:${title}`} />
    </div>
  );
}
