import { phases } from '../../shared/scenarios.js';

const items = [
  { title: 'Cart', content: 'Review items' },
  { title: 'Shipping', subTitle: 'Left 00:00:08', content: 'Address and method' },
  { title: 'Payment', content: 'Card details' },
  { title: 'Done', disabled: true },
];
const base = { items, initialCurrent: 1, status: 'process', clickable: true };
const unstable = { name: 'UnstableContext', value: {} };
const steps = () => globalThis.__steps;
const keepNode = (node) => node;

function clickStep(index) {
  const nodes = steps().root.querySelectorAll('.rc-steps-item');
  nodes[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export default [
  ...phases(
    'CheckoutSteps',
    base,
    {
      same_items: { ...base, items: [...items] },
      error: { ...base, status: 'error' },
      vertical: { ...base, orientation: 'vertical' },
      title_vertical: { ...base, titlePlacement: 'vertical' },
      not_clickable: { ...base, clickable: false },
      class_names: { ...base, classNames: { item: 'step', itemTitle: 'step-title' } },
      item_render: { ...base, itemRender: keepNode },
      fewer: { ...base, items: items.slice(0, 2) },
    },
    { context: unstable },
  ),
  {
    name: 'rail_follow',
    component: 'CheckoutSteps',
    props: base,
    context: unstable,
    steps: [
      { name: 'same_context', context: {} },
      { name: 'follow_prev', context: { railFollowPrevStatus: true } },
    ],
  },
  {
    name: 'click',
    component: 'CheckoutSteps',
    props: base,
    context: unstable,
    steps: [
      { name: 'click_payment', act: () => clickStep(2) },
      { name: 'click_payment_again', act: () => clickStep(2) },
      { name: 'click_disabled', act: () => clickStep(3) },
      { name: 'click_cart', act: () => clickStep(0) },
    ],
  },
  {
    name: 'set_current',
    component: 'CheckoutSteps',
    props: base,
    context: unstable,
    steps: [
      { name: 'same_current', act: () => steps().setCurrent(1) },
      { name: 'last', act: () => steps().setCurrent(3) },
    ],
  },
];
