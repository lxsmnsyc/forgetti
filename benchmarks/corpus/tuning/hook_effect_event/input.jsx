import { useState, useEffect, useEffectEvent } from 'react';
import { bump } from '../../shared/counter.js';
export function EffectEvent({ tag, n }) {
  const [seen, setSeen] = useState(0);
  const onTick = useEffectEvent(() => { bump('tick'); setSeen((s) => s + n); });
  useEffect(() => { onTick(); }, [tag]);
  return <p>{tag}:{seen}</p>;
}
