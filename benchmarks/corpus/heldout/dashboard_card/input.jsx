import { useState, useMemo, useEffect, useRef } from 'react';
import { bump, Child } from '../../shared/counter.js';

function formatMoney(value, currency) {
  bump('format');
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const [whole, cents] = abs.toFixed(2).split('.');
  let grouped = '';
  for (let i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 === 0) {
      grouped += ',';
    }
    grouped += whole[i];
  }
  return `${sign}${currency}${grouped}.${cents}`;
}

function formatPercent(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

// Turns a series into an SVG path scaled to the box.
function buildPath(series, width, height) {
  bump('path');
  if (series.length < 2) {
    return '';
  }
  let min = series[0];
  let max = series[0];
  for (const point of series) {
    if (point < min) {
      min = point;
    }
    if (point > max) {
      max = point;
    }
  }
  const span = max - min || 1;
  const step = width / (series.length - 1);
  let path = '';
  for (const [i, point] of series.entries()) {
    const x = (i * step).toFixed(1);
    const y = (height - ((point - min) / span) * height).toFixed(1);
    path += `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }
  return path;
}

function Sparkline({ series, width = 120, height = 32, tone }) {
  const path = useMemo(() => buildPath(series, width, height), [series, width, height]);
  return (
    <svg width={width} height={height} data-tone={tone}>
      <path d={path} fill="none" strokeWidth="1.5" />
    </svg>
  );
}

// Flags a value that changed since the last render so the cell can flash.
function useChanged(value) {
  const previous = useRef(value);
  const changed = previous.current !== value;
  useEffect(() => {
    previous.current = value;
  });
  return changed;
}

function StatRow({ symbol, price, open, currency }) {
  const change = (price - open) / open;
  const flash = useChanged(price);
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return (
    <li className={`stat ${tone}${flash ? ' flash' : ''}`}>
      <span className="symbol">{symbol}</span>
      <span className="price">{formatMoney(price, currency)}</span>
      <span className="change">{formatPercent(change)}</span>
    </li>
  );
}

export function MarketCard({ title, quotes, history, currency, limit }) {
  const [sortBy, setSortBy] = useState('symbol');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    globalThis.__card = { setSortBy, setCollapsed };
  }, []);

  const rows = quotes.slice(0, limit || quotes.length);
  rows.sort((a, b) => {
    if (sortBy === 'change') {
      return (b.price - b.open) / b.open - (a.price - a.open) / a.open;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  let total = 0;
  let best = null;
  for (const quote of rows) {
    total += quote.price * quote.shares;
    if (best === null || quote.price / quote.open > best.price / best.open) {
      best = quote;
    }
  }

  const series = history[rows[0] ? rows[0].symbol : ''] || [];

  return (
    <section className="card">
      <header>
        <h3>{title}</h3>
        <button onClick={() => setCollapsed(!collapsed)}>{collapsed ? 'Show' : 'Hide'}</button>
      </header>
      <div className="total">{formatMoney(total, currency)}</div>
      <Child v={best ? `best: ${best.symbol}` : 'no quotes'} />
      {collapsed ? null : (
        <>
          <Sparkline series={series} tone={total > 0 ? 'up' : 'flat'} />
          <ul>
            {rows.map((quote) => (
              <StatRow
                key={quote.symbol}
                symbol={quote.symbol}
                price={quote.price}
                open={quote.open}
                currency={currency}
              />
            ))}
          </ul>
        </>
      )}
      <footer>
        Sorted by {sortBy}, {rows.length} of {quotes.length} shown
      </footer>
    </section>
  );
}
