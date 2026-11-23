import { phases } from '../../shared/scenarios.js';

const base = { initialValue: 3, count: 5, allowHalf: false, allowClear: true };
const rate = () => globalThis.__rate;
const heart = () => '♥';

function clickStar(index) {
  const stars = rate().root.querySelectorAll('[role="radio"]');
  stars[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressKey(keyCode) {
  const list = rate().root.querySelector('ul');
  list.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode }));
}

export default [
  ...phases('ReviewRating', base, {
    same_props: { ...base },
    more_stars: { ...base, count: 10 },
    half: { ...base, allowHalf: true },
    disabled: { ...base, disabled: true },
    rtl: { ...base, direction: 'rtl' },
    character_fn: { ...base, character: heart },
  }),
  {
    name: 'click',
    component: 'ReviewRating',
    props: base,
    steps: [
      { name: 'click_fifth', act: () => clickStar(4) },
      { name: 'click_fifth_clears', act: () => clickStar(4) },
      { name: 'click_first', act: () => clickStar(0) },
    ],
  },
  {
    name: 'keyboard',
    component: 'ReviewRating',
    props: base,
    steps: [
      { name: 'right', act: () => pressKey(39) },
      { name: 'right_at_max', act: () => pressKey(39) },
      { name: 'left', act: () => pressKey(37) },
    ],
  },
  {
    name: 'set_value',
    component: 'ReviewRating',
    props: base,
    steps: [
      { name: 'same_value', act: () => rate().setValue(3) },
      { name: 'zero', act: () => rate().setValue(0) },
      { name: 'rerender', props: { ...base } },
    ],
  },
];
