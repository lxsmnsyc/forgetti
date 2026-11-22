import { phases } from '../../shared/scenarios.js';

const quotes = [
  { symbol: 'AAA', price: 120.5, open: 118, shares: 10 },
  { symbol: 'BBB', price: 48.25, open: 50, shares: 100 },
  { symbol: 'CCC', price: 1500, open: 1500, shares: 1 },
];
const history = { AAA: [118, 119, 117, 121, 120.5], BBB: [50, 49, 48.25] };
const base = { title: 'Holdings', quotes, history, currency: '$', limit: 0 };
const card = () => globalThis.__card;

// The component sorts the quotes it is given, so each use gets its own copy.
const copy = () => quotes.map((quote) => ({ ...quote }));

export default [
  ...phases('MarketCard', () => ({ ...base, quotes: copy() }), {
    new_title: () => ({ ...base, quotes: copy(), title: 'Positions' }),
    new_history: () => ({ ...base, quotes: copy(), history: { ...history } }),
    new_quotes: () => ({ ...base, quotes: copy() }),
    one_price: () => ({
      ...base,
      quotes: quotes.map((quote, i) => (i === 0 ? { ...quote, price: 125 } : { ...quote })),
    }),
    one_currency: () => ({ ...base, quotes: copy(), currency: 'EUR ' }),
    one_limit: () => ({ ...base, quotes: copy(), limit: 2 }),
  }),
  {
    name: 'interaction',
    component: 'MarketCard',
    props: () => ({ ...base, quotes: copy() }),
    steps: [
      { name: 'sort_change', act: () => card().setSortBy('change') },
      { name: 'collapse', act: () => card().setCollapsed(true) },
      {
        name: 'tick_collapsed',
        props: () => ({ ...base, quotes: copy().map((q) => ({ ...q, price: q.price + 1 })) }),
      },
      { name: 'expand', act: () => card().setCollapsed(false) },
      { name: 'sort_symbol', act: () => card().setSortBy('symbol') },
    ],
  },
];
