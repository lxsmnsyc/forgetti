import { phases } from '../../shared/scenarios.js';

const products = [
  { id: 1, title: 'iPad 4 Mini', price: 500.01, inventory: 2 },
  { id: 2, title: 'H&M T-Shirt White', price: 10.99, inventory: 10 },
  { id: 3, title: 'Charli XCX - Sucker CD', price: 19.99, inventory: 0 },
];
const base = { products, discount: 0, onCheckout: undefined };
const shop = () => globalThis.__shop;
const add = (id) => () => shop().dispatch({ type: 'ADD', id });

export default [
  ...phases('Shop', base, {
    new_products: { ...base, products: [...products] },
    one_price: { ...base, products: [products[0], { ...products[1], price: 12 }, products[2]] },
    one_discount: { ...base, discount: 0.1 },
    new_checkout: { ...base, onCheckout: () => {} },
  }),
  {
    name: 'shopping',
    component: 'Shop',
    props: base,
    steps: [
      { name: 'add_ipad', act: add(1) },
      { name: 'add_shirt', act: add(2) },
      { name: 'add_ipad_again', act: add(1) },
      { name: 'discount', props: { ...base, discount: 0.25 } },
      { name: 'remove_shirt', act: () => shop().dispatch({ type: 'REMOVE', id: 2 }) },
      { name: 'checkout', act: () => shop().dispatch({ type: 'CHECKOUT' }) },
      { name: 'count', act: () => shop().setCheckedOut(5) },
    ],
  },
];
