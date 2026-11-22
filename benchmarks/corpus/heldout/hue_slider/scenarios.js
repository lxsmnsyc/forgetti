import { phases } from '../../shared/scenarios.js';

// The harness container is detached, so a ref on a wrapper div gives the steps a root to query.
const wrap = (h, element) => h('div', { ref: (node) => (globalThis.__root = node) }, element);
const all = (selector) => globalThis.__root.querySelectorAll(selector);

const onChange = () => {};
const onChangeEnd = () => {};
const base = { hue: 200, className: 'last', onChange, onChangeEnd };

function pressKey(keyCode) {
  const slider = all('[role=slider]')[0];
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { value: keyCode });
  slider.dispatchEvent(event);
}

export default [
  ...phases('Hue', base, {
    one_hue: { ...base, hue: 201 },
    far_hue: { ...base, hue: 0 },
    end_hue: { ...base, hue: 360 },
    one_class: { ...base, className: 'first' },
    new_callback: { ...base, onChange: () => {} },
    new_end: { ...base, onChangeEnd: () => {} },
    no_end: { hue: 200, className: 'last', onChange },
  }),
  {
    name: 'keys',
    wrap,
    component: 'Hue',
    props: base,
    steps: [
      { name: 'right', act: () => pressKey(39) },
      { name: 'left', act: () => pressKey(37) },
      { name: 'other_key', act: () => pressKey(65) },
      { name: 'new_hue', props: { ...base, hue: 90 } },
      { name: 'right_again', act: () => pressKey(39) },
    ],
  },
];
