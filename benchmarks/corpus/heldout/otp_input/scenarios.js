import { phases } from '../../shared/scenarios.js';

// The harness container is detached, so a ref on a wrapper div gives the steps a root to query.
const wrap = (h, element) => h('div', { ref: (node) => (globalThis.__root = node) }, element);
const all = (selector) => globalThis.__root.querySelectorAll(selector);

const onChange = () => {};
const base = { value: '12', numInputs: 4, onChange, inputType: 'text' };

// Sets the value through the native setter so both targets see an input event.
function typeValue(index, value) {
  const input = all('input')[index];
  let proto = Object.getPrototypeOf(input);
  while (proto && !Object.getOwnPropertyDescriptor(proto, 'value')) {
    proto = Object.getPrototypeOf(proto);
  }
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function keyDown(index, init) {
  const input = all('input')[index];
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

export default [
  ...phases('OtpField', base, {
    one_value: { ...base, value: '1234' },
    empty_value: { ...base, value: '' },
    more_inputs: { ...base, numInputs: 6 },
    fewer_inputs: { ...base, numInputs: 2 },
    number_type: { ...base, inputType: 'number' },
    with_placeholder: { ...base, placeholder: '----' },
    with_styles: { ...base, containerStyle: 'box', inputStyle: { color: 'red' } },
    skip_styles: { ...base, skipDefaultStyles: true },
    new_change: { ...base, onChange: () => {} },
  }),
  {
    name: 'focus_and_keys',
    wrap,
    component: 'OtpField',
    props: base,
    steps: [
      { name: 'focus_second', act: () => all('input')[1].focus() },
      { name: 'arrow_right', act: () => keyDown(1, { code: 'ArrowRight', key: 'ArrowRight' }) },
      { name: 'backspace', act: () => keyDown(2, { code: 'Backspace', key: 'Backspace' }) },
      { name: 'same_key', act: () => keyDown(0, { code: 'Digit1', key: '1' }) },
      { name: 'space', act: () => keyDown(0, { code: 'Space', key: ' ' }) },
      { name: 'type_third', act: () => typeValue(2, '7') },
      { name: 'type_fourth', act: () => typeValue(3, '8') },
      { name: 'type_invalid', act: () => typeValue(0, 'ab') },
      { name: 'new_count', props: { ...base, numInputs: 5 } },
    ],
  },
  {
    name: 'autofocus',
    wrap,
    component: 'OtpField',
    props: { ...base, shouldAutoFocus: true },
    steps: [
      { name: 'same' },
      { name: 'one_value', props: { ...base, shouldAutoFocus: true, value: '99' } },
    ],
  },
];
