import { phases } from '../../shared/scenarios.js';

const prices = (id, month, year) => [
  { id: `${id}_m`, interval: 'month', currency: 'usd', unit_amount: month },
  { id: `${id}_y`, interval: 'year', currency: 'usd', unit_amount: year },
];
const products = [
  {
    id: 'p1',
    name: 'Hobbyist',
    description: 'For side projects',
    prices: prices('p1', 1000, 10000),
  },
  { id: 'p2', name: 'Freelancer', description: 'For clients', prices: prices('p2', 2000, 20000) },
];
const user = { id: 'u1' };
const subscription = { prices: { products: { name: 'Hobbyist' } } };
const onNavigate = () => {};
const checkout = async () => ({ sessionId: 's1' });
const base = { user, products, subscription: null, onNavigate, checkout };
const pricing = () => globalThis.__pricing;

export default [
  ...phases('default', base, {
    same_products: { ...base, products: [...products] },
    subscribed: { ...base, subscription },
    no_user: { ...base, user: null },
    fewer: { ...base, products: products.slice(0, 1) },
    empty: { ...base, products: [] },
    new_checkout: { ...base, checkout: async () => ({ sessionId: 's2' }) },
  }),
  {
    name: 'interval',
    component: 'default',
    props: base,
    steps: [
      { name: 'year', act: () => pricing().setBillingInterval('year') },
      { name: 'year_again', act: () => pricing().setBillingInterval('year') },
      { name: 'month', act: () => pricing().setBillingInterval('month') },
    ],
  },
  {
    name: 'buy',
    component: 'default',
    props: base,
    steps: [{ name: 'buy', act: () => pricing().buy(products[0].prices[0]) }],
  },
  {
    name: 'buy_signed_out',
    component: 'default',
    props: { ...base, user: null },
    steps: [{ name: 'buy', act: () => pricing().buy(products[0].prices[0]) }],
  },
];
