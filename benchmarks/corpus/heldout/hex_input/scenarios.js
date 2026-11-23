import { phases } from '../../shared/scenarios.js';

// The harness container is detached, so a ref on a wrapper div gives the steps a root to query.
const wrap = (h, element) => h('div', { ref: (node) => (globalThis.__root = node) }, element);
const all = (selector) => globalThis.__root.querySelectorAll(selector);

const onChange = () => {};
const onBlur = () => {};
const base = { color: '#ff8800', prefixed: true, alpha: false, onChange, onBlur };

// Sets the value through the native setter so both targets see an input event.
function typeValue(value) {
  const input = all('input')[0];
  let proto = Object.getPrototypeOf(input);
  while (proto && !Object.getOwnPropertyDescriptor(proto, 'value')) {
    proto = Object.getPrototypeOf(proto);
  }
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blurInput() {
  const input = all('input')[0];
  // React listens for focusout and Preact for blur.
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('blur'));
}

export default [
  ...phases('HexColorInput', base, {
    one_color: { ...base, color: '#00ff88' },
    short_color: { ...base, color: '#fa0' },
    no_prefix: { ...base, prefixed: false },
    with_alpha: { ...base, alpha: true, color: '#ff880080' },
    new_change: { ...base, onChange: () => {} },
    new_blur: { ...base, onBlur: () => {} },
    one_class: { ...base, className: 'hex' },
  }),
  {
    name: 'typing',
    wrap,
    component: 'HexColorInput',
    props: base,
    steps: [
      { name: 'valid', act: () => typeValue('00ff00') },
      { name: 'invalid', act: () => typeValue('00ff') },
      { name: 'blur_invalid', act: blurInput },
      { name: 'junk', act: () => typeValue('zz12') },
      { name: 'new_color', props: { ...base, color: '#123456' } },
      { name: 'blur_valid', act: blurInput },
    ],
  },
];
