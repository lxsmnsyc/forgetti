import { phases } from '../../shared/scenarios.js';

function makeVariant(color, size, availableForSale) {
  return {
    id: `v-${color}-${size}`,
    title: `${color} / ${size}`,
    availableForSale,
    selectedOptions: [
      { name: 'Color', value: color },
      { name: 'Size', value: size },
    ],
    price: { amount: '25.00', currencyCode: 'USD' },
  };
}

const product = {
  id: 'p1',
  handle: 'shirt',
  title: 'Acme Shirt',
  availableForSale: true,
  descriptionHtml: '<p>Soft cotton.</p>',
  featuredImage: null,
  priceRange: { maxVariantPrice: { amount: '25.00', currencyCode: 'USD' } },
  options: [
    { id: 'o1', name: 'Color', values: ['Black', 'White'] },
    { id: 'o2', name: 'Size', values: ['S', 'M', 'L'] },
  ],
  variants: [
    makeVariant('Black', 'S', true),
    makeVariant('Black', 'M', true),
    makeVariant('Black', 'L', false),
    makeVariant('White', 'S', true),
    makeVariant('White', 'M', false),
    makeVariant('White', 'L', true),
  ],
};
const soldOut = { ...product, availableForSale: false };
const base = { product, initialSearch: 'color=Black', initialCart: undefined };
const page = () => globalThis.__product;

function clickButton(title) {
  const button = page().root.querySelector(`button[title="${title}"]`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// Submits the add-to-cart form, as a click on its enabled submit button would.
function submitCart() {
  const forms = page().root.querySelectorAll('form');
  forms[forms.length - 1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

export default [
  ...phases('ProductPage', base, {
    same_product: { ...base, product: { ...product } },
    sold_out: { ...base, product: soldOut },
    no_description: { ...base, product: { ...product, descriptionHtml: '' } },
  }),
  {
    name: 'options',
    component: 'ProductPage',
    props: base,
    steps: [
      { name: 'pick_size_s', act: () => clickButton('Size S') },
      { name: 'pick_white', act: () => clickButton('Color White') },
      { name: 'same_search', act: () => page().setSearch('color=White&size=S') },
      { name: 'pick_large', act: () => clickButton('Size L') },
    ],
  },
  {
    name: 'cart',
    component: 'ProductPage',
    props: { ...base, initialSearch: 'color=Black&size=S' },
    steps: [
      { name: 'add', act: () => submitCart() },
      { name: 'add_again', act: () => submitCart() },
      { name: 'rerender', props: { ...base, initialSearch: 'color=Black&size=S' } },
    ],
  },
  {
    name: 'cart_other_variant',
    component: 'ProductPage',
    props: { ...base, initialSearch: 'color=Black&size=S' },
    steps: [
      { name: 'add', act: () => submitCart() },
      { name: 'pick_white', act: () => clickButton('Color White') },
      { name: 'add_white', act: () => submitCart() },
    ],
  },
];
